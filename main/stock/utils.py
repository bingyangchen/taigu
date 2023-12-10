import csv
from contextlib import suppress
from datetime import datetime, timedelta
from io import StringIO
from time import sleep

import pytz
import requests
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from dateutil.relativedelta import relativedelta
from django.conf import settings
from django_apscheduler import util
from django_apscheduler.jobstores import DjangoJobStore
from django_apscheduler.models import DjangoJobExecution
from pyquery import PyQuery

from . import Frequency, InfoEndpoint, TradeType, UnknownStockIdError
from .models import Company, History, MarketIndexPerMinute, StockInfo


def fetch_company_info(sid: str) -> dict:
    response = requests.post(f"{InfoEndpoint.company}{sid}")
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


@util.close_old_connections
def fetch_and_store_realtime_stock_info() -> None:
    print("Start Fetching Realtime Stock Info")
    query_set = Company.objects.filter(trade_type__isnull=False).values(
        "pk", "trade_type"
    )
    all = list(map(lambda x: f"{x['trade_type']}_{x['pk']}.tw", query_set))
    batch_size = 150
    print(f"Expected request count: {len(all) / batch_size}")
    while len(all) > 0:
        start = datetime.now()
        url = f"{InfoEndpoint.realtime['stock']}{'|'.join(all[:batch_size])}"
        try:
            response = requests.get(url, timeout=10)
            json_data = response.json()
            for row in json_data["msgArray"]:
                try:
                    # parse row data
                    company_id = row["c"]
                    date = datetime.strptime(row["d"], "%Y%m%d").date()
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
                except Exception as e:
                    print(e)
                    continue
            print(".", end="")
        except Exception as e:
            print("x")
            print(e)
        finally:
            all = all[batch_size:]

            # deal with rate limit (3 requests per 5 seconds)
            sleep(max(0, 2 - (datetime.now() - start).total_seconds()))
    print("\nAll Realtime Stock Info Updated!")


@util.close_old_connections
def fetch_and_store_market_per_minute_info() -> None:
    sleep(10)  # Wait for market to fully open
    now = (datetime.now(pytz.utc) + timedelta(hours=8)).time()
    minutes_after_opening = (now.hour - 9) * 60 + now.minute

    # Do nothing during 13:30 ~ 13:58
    if 269 < minutes_after_opening < 298:
        return

    # Convert the last few minutes to 270
    if minutes_after_opening >= 298:
        minutes_after_opening = 270

    # TSE
    try:
        tse_response = requests.get(InfoEndpoint.realtime[TradeType.TSE]).json()
        latest_day_info = max(tse_response, key=lambda x: int(x["Date"]))
        date_in_data = datetime.strptime(
            str(19110000 + int(latest_day_info["Date"])), "%Y%m%d"
        ).date()

        # Delete data that are not belong to the latest day
        MarketIndexPerMinute.objects.filter(market=TradeType.TSE).exclude(
            date=date_in_data
        ).delete()

        MarketIndexPerMinute.objects.get_or_create(
            market=TradeType.TSE,
            date=date_in_data,
            number=minutes_after_opening,
            defaults={
                "price": round(float(latest_day_info["TAIEX"]), 2),
                "fluct_price": round(float(latest_day_info["Change"]), 2),
            },
        )
    except Exception as e:
        print(e)

    # OTC
    try:
        otc_response = requests.get(InfoEndpoint.realtime[TradeType.OTC]).json()[0]
        date_in_data = datetime.strptime(
            str(19110000 + int(otc_response["Date"])), "%Y%m%d"
        ).date()

        # Delete data that are not belong to the latest day
        MarketIndexPerMinute.objects.filter(market=TradeType.OTC).exclude(
            date=date_in_data
        ).delete()

        MarketIndexPerMinute.objects.get_or_create(
            market=TradeType.OTC,
            date=date_in_data,
            number=minutes_after_opening,
            defaults={
                "price": round(float(otc_response["CloseIndex"]), 2),
                "fluct_price": round(float(otc_response["IndexChange"]), 2),
            },
        )
    except Exception as e:
        print(e)
    print("Realtime Market Index Updated!")


@util.close_old_connections
def fetch_and_store_close_info_today() -> None:
    date = (datetime.now(pytz.utc) + timedelta(hours=8)).date()

    # Process TSE stocks
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
            except Exception as e:
                print(e)
                continue
    except Exception as e:
        print(e)

    # Process OTC stocks
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
            except Exception as e:
                print(e)
                continue
    except Exception as e:
        print(e)
    print("Stock info is up to date!")


def fetch_and_store_historical_info_yahoo(company: Company, frequency: str) -> None:
    end = datetime.now()
    start = end - relativedelta(days=80)
    interval = "1d"
    if frequency == Frequency.WEEKLY:
        start = end - relativedelta(weeks=55)
        interval = "1wk"
    elif frequency == Frequency.MONTHLY:
        start = end - relativedelta(months=55)
        interval = "1mo"

    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3"  # noqa: E501
    }
    response = requests.get(
        f"{InfoEndpoint.multiple_days}{company.pk}.{'TW' if company.trade_type == TradeType.TSE else 'TWO'}?period1={int(start.timestamp())}&period2={int(end.timestamp())}&interval={interval}&events=history&includeAdjustedClose=true",  # noqa: E501
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
                date=datetime.strptime(row[0], "%Y-%m-%d").date(),
                quantity=quantity,
                close_price=close_price,
            )


@util.close_old_connections
def update_all_stocks_history() -> None:
    for company in Company.objects.filter(trade_type__isnull=False):
        start = datetime.now()
        with suppress(Exception):
            fetch_and_store_historical_info_yahoo(
                company=company, frequency=Frequency.DAILY
            )

        # deal with rate limit (3000 per hour)
        sleep(max(0, 2 - (datetime.now() - start).total_seconds()))


def set_up_cron_jobs() -> None:
    DjangoJobExecution.objects.delete_old_job_executions(0)
    scheduler = BackgroundScheduler(timezone=settings.TIME_ZONE)
    scheduler.add_jobstore(DjangoJobStore(), "default")
    scheduler.remove_all_jobs()
    scheduler.add_job(
        fetch_and_store_realtime_stock_info,
        trigger=CronTrigger.from_crontab("* 9-14 * * MON-FRI"),
        id="fetch_and_store_realtime_stock_info",
        max_instances=1,
        replace_existing=True,
    )
    scheduler.add_job(
        fetch_and_store_market_per_minute_info,
        trigger=CronTrigger.from_crontab("* 9-14 * * MON-FRI"),
        id="fetch_and_store_market_per_minute_info",
        max_instances=1,
        replace_existing=True,
    )
    scheduler.add_job(
        fetch_and_store_close_info_today,
        trigger=CronTrigger.from_crontab("4 14 * * MON-FRI"),
        id="fetch_and_store_close_info_today",
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
