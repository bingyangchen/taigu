import csv
import datetime
from io import StringIO
from time import sleep

import pytz
import requests
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from dateutil.relativedelta import relativedelta
from django.conf import settings
from django_apscheduler.jobstores import DjangoJobStore
from django_apscheduler.models import DjangoJobExecution
from pyquery import PyQuery

from . import Frequency, InfoEndpoint, TradeType, UnknownStockIdError
from .models import Company, History, StockInfo


def fetch_company_info(sid: str) -> dict:
    response = requests.post(
        f"https://isin.twse.com.tw/isin/single_main.jsp?owncode={sid}"
    )
    document = PyQuery(response.text)
    name = document.find("tr:nth-child(2)>td:nth-child(4)").text()
    trade_type = document.find("tr:nth-child(2)>td:nth-child(5)").text()
    if name:
        return {
            "name": str(name),
            "trade_type": TradeType.TRADE_TYPE_ZH_ENG_MAP.get(str(trade_type)),
        }
    else:
        raise UnknownStockIdError("Unknown Stock ID")


def fetch_and_store_real_time_info() -> None:
    queryset = Company.objects.filter(trade_type__isnull=False).values(
        "pk", "trade_type"
    )
    all = list(map(lambda x: f"{x['trade_type']}_{x['pk']}.tw", queryset))
    batch_size = 150
    while len(all) > 0:
        start_timestamp = datetime.datetime.now()
        query = "|".join(all[:batch_size])
        url = f"{InfoEndpoint.single_day['real_time']}{query}"
        try:
            r = requests.get(url, timeout=7).json()
            for row in r["msgArray"]:
                try:
                    # parse row data
                    company_id = row["c"]
                    date = datetime.datetime.strptime(row["d"], "%Y%m%d").date()
                    quantity = (int(row["v"]) * 1000) if row["v"] != "-" else 0
                    yesterday_price = (
                        round(float(row["y"]), 2) if row["y"] != "-" else 0.0
                    )
                    current_dealt_price = (
                        round(float(row["z"]), 2) if row["z"] != "-" else None
                    )
                    lowest_ask_price = (
                        round(float(row["a"].split("_")[0]), 2)
                        if row["a"] != "-"
                        else None
                    )
                    highest_bid_price = (
                        round(float(row["b"].split("_")[0]), 2)
                        if row["b"] != "-"
                        else None
                    )
                    price_upper_bound = (
                        round(float(row["u"]), 2) if row["u"] != "-" else None
                    )
                    price_lower_bound = (
                        round(float(row["w"]), 2)
                        if row.get("w") and (row["w"] != "-")
                        else None
                    )

                    # Determine the realtime price
                    price = 0.0
                    if current_dealt_price:
                        price = current_dealt_price
                    elif lowest_ask_price and highest_bid_price:
                        price = round(
                            (lowest_ask_price + highest_bid_price) / 2,
                            2,
                        )
                    elif highest_bid_price and price_upper_bound:
                        price = price_upper_bound
                    elif lowest_ask_price and price_lower_bound:
                        price = price_lower_bound
                    elif yesterday_price:
                        price = yesterday_price

                    # create or update stock info
                    StockInfo.objects.update_or_create(
                        company=Company.objects.get(pk=company_id),
                        defaults={
                            "date": date,
                            "quantity": quantity,
                            "close_price": price,
                            "fluct_price": round(price - yesterday_price, 2),
                        },
                    )
                except Exception:
                    continue
        except Exception as e:
            print(e)

        all = all[batch_size:]

        # deal with rate limit (3 requests per 5 seconds)
        sleep(max(0, 1.8 - (datetime.datetime.now() - start_timestamp).total_seconds()))
    print("All Realtime Stock Info Updated")


def fetch_and_store_latest_day_info() -> None:
    date = (datetime.datetime.now(pytz.utc) + datetime.timedelta(hours=8)).date()

    # Process TSE trade type
    try:
        tse_response: list[dict[str, str]] = requests.get(
            InfoEndpoint.single_day[TradeType.TSE]
        ).json()
        for row in tse_response:
            try:
                company, created = Company.objects.update_or_create(
                    pk=row["Code"],
                    defaults={
                        "name": row["Name"],
                        "trade_type": TradeType.TSE,
                    },
                )
                StockInfo.objects.update_or_create(
                    company=company,
                    defaults={
                        "date": date,
                        "quantity": int(row["TradeVolume"] or 0),
                        "close_price": round(
                            float(row["ClosingPrice"] or row["HighestPrice"] or 0.0),
                            2,
                        ),
                        "fluct_price": round(float(row["Change"] or 0.0), 2),
                    },
                )
            except Exception:
                continue
    except Exception as e:
        print(str(e))

    # Process OTC trade type
    try:
        otc_response: list[dict[str, str]] = requests.get(
            InfoEndpoint.single_day[TradeType.OTC]
        ).json()
        for row in otc_response:
            try:
                company, created = Company.objects.update_or_create(
                    pk=row["SecuritiesCompanyCode"],
                    defaults={
                        "name": row["CompanyName"],
                        "trade_type": TradeType.OTC,
                    },
                )
                StockInfo.objects.update_or_create(
                    company=company,
                    defaults={
                        "date": date,
                        "quantity": int(
                            row["TradingShares"]
                            if row["TradingShares"].find("--") == -1
                            else 0
                        ),
                        "close_price": round(
                            float(
                                row["Close"]
                                if row["Close"].find("--") == -1
                                else (
                                    row["High"] if row["High"].find("--") == -1 else 0
                                )
                            ),
                            2,
                        ),
                        "fluct_price": round(
                            float(
                                row["Change"] if row["Change"].find("--") == -1 else 0
                            ),
                            2,
                        ),
                    },
                )
            except Exception:
                continue
    except Exception as e:
        print(str(e))
    print("Stock Info of Latest Day Updated")


def fetch_and_store_historical_info_yahoo(company: Company, frequency: str) -> None:
    end_datetime = datetime.datetime.now()
    start_datetime = end_datetime - relativedelta(days=80)
    interval = "1d"
    if frequency == Frequency.WEEKLY:
        start_datetime = end_datetime - relativedelta(weeks=55)
        interval = "1wk"
    elif frequency == Frequency.MONTHLY:
        start_datetime = end_datetime - relativedelta(months=55)
        interval = "1mo"

    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3"  # noqa: E501
    }
    response = requests.get(
        f"{InfoEndpoint.multiple_days}{company.pk}.{'TW' if company.trade_type == TradeType.TSE else 'TWO'}?period1={int(start_datetime.timestamp())}&period2={int(end_datetime.timestamp())}&interval={interval}&events=history&includeAdjustedClose=true",  # noqa: E501
        headers=headers,
    )
    data = StringIO(response.text)
    csv_reader = csv.reader(data)
    History.objects.filter(company=company, frequency=frequency).delete()
    for row in csv_reader:
        # ['Date', 'Open', 'High', 'Low', 'Close', 'Adj Close', 'Volume']
        if "Date" not in row:
            try:
                quantity = int(row[-1])
            except Exception:
                quantity = 0
            try:
                close_price = round(float(row[4]), 2)
            except Exception:
                close_price = 0.0
            History.objects.create(
                company=company,
                frequency=frequency,
                date=datetime.datetime.strptime(row[0], "%Y-%m-%d").date(),
                quantity=quantity,
                close_price=close_price,
            )


def update_all_stocks_history() -> None:
    for company in Company.objects.filter(trade_type__isnull=False):
        start_timestamp = datetime.datetime.now()
        try:
            fetch_and_store_historical_info_yahoo(
                company=company, frequency=Frequency.DAILY
            )
        except Exception:
            ...

        # deal with rate limit (3000 per hour)
        sleep(max(0, 2 - (datetime.datetime.now() - start_timestamp).total_seconds()))


def set_up_cron_jobs() -> None:
    DjangoJobExecution.objects.delete_old_job_executions(0)
    scheduler = BackgroundScheduler(timezone=settings.TIME_ZONE)
    scheduler.add_jobstore(DjangoJobStore(), "default")
    scheduler.remove_all_jobs()
    scheduler.add_job(
        fetch_and_store_latest_day_info,
        trigger=CronTrigger.from_crontab("4 14 * * MON-FRI"),
        id="fetch_and_store_latest_day_info",
        max_instances=1,
        replace_existing=True,
    )
    scheduler.add_job(
        fetch_and_store_real_time_info,
        trigger=CronTrigger.from_crontab("0/2 9-14 * * MON-FRI"),
        id="fetch_and_store_real_time_info",
        max_instances=1,
        replace_existing=True,
    )
    scheduler.add_job(
        update_all_stocks_history,
        trigger=CronTrigger.from_crontab("0 1 * * MON-FRI"),
        id="update_all_stocks_history",
        max_instances=1,
        replace_existing=True,
    )
    scheduler.start()
