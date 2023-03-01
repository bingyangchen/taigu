import requests
from pyquery import PyQuery
import datetime
import pytz

from django.conf import settings
from django_apscheduler.jobstores import DjangoJobStore
from apscheduler.triggers.cron import CronTrigger
from apscheduler.schedulers.background import BackgroundScheduler
from django_apscheduler.models import DjangoJobExecution

from . import TradeType, InfoEndpoint
from .models import Company, StockInfo


class UnknownStockIdError(Exception):
    pass


def validate_stock_id(sid: str):
    if not get_company_info(sid):
        raise UnknownStockIdError("Unknown Stock ID")


def get_company_info(sid: str):
    res = requests.post(f"https://isin.twse.com.tw/isin/single_main.jsp?owncode={sid}")
    doc = PyQuery(res.text)
    name = doc.find("tr:nth-child(2)>td:nth-child(4)").text()
    trade_type = doc.find("tr:nth-child(2)>td:nth-child(5)").text()
    return (
        {
            "name": name,
            "trade_type": TradeType.TSE
            if trade_type == "上市"
            else (TradeType.OTC if trade_type == "上櫃" else None),
        }
        if name
        else None
    )


def fetch_and_store_real_time_info():
    queryset = Company.objects.filter(trade_type__isnull=False).values(
        "pk", "trade_type"
    )
    all = list(map(lambda x: f"{x['trade_type']}_{x['pk']}.tw", queryset))
    while len(all) > 0:
        ex_ch = "|".join(all[:150])
        url = f"https://mis.twse.com.tw/stock/api/getStockInfo.jsp?ex_ch={ex_ch}"
        try:
            r = requests.get(url).json()
            for row in r["msgArray"]:
                date = datetime.datetime.strptime(row["d"], "%Y%m%d").date()
                quantity = (int(row["v"]) * 1000) if row["v"] != "-" else 0
                old_price = round(float(row["y"]), 2) if row["y"] != "-" else 0

                # Determine Price
                if row["z"] != "-":
                    price = round(float(row["z"]), 2)
                elif ((asks := row["a"]) != "-") and ((bids := row["b"]) != "-"):
                    price = round(
                        (float(asks.split("_")[0]) + float(bids.split("_")[0])) / 2, 2
                    )
                elif old_price:
                    price = old_price
                else:
                    price = None

                if si := StockInfo.objects.filter(company__pk=row["c"]).first():
                    si.date = date
                    si.quantity = quantity
                    if price:
                        si.close_price = price
                        if old_price:
                            si.fluct_price = round(price - old_price, 2)
                    si.save()
                else:
                    StockInfo.objects.create(
                        company=Company.objects.get(pk=row["c"]),
                        date=date,
                        quantity=quantity,
                        close_price=price,
                        fluct_price=round(price - old_price, 2)
                        if (price and old_price)
                        else 0,
                    )
        except Exception as e:
            print(str(e))
        all = all[150:]
    print("Realtime Info Updated")


def fetch_and_store_latest_day_info():
    date = (datetime.datetime.now(pytz.utc) + datetime.timedelta(hours=8)).date()
    current_hour = int(
        (datetime.datetime.now(pytz.utc) + datetime.timedelta(hours=8)).strftime("%H")
    )
    if current_hour < 14:
        date -= datetime.timedelta(days=1)

    try:
        res_tse = requests.get(InfoEndpoint.endpoints["single_day"]["tse"]).json()
        for each in res_tse:
            try:
                c, created = Company.objects.update_or_create(
                    pk=each["Code"],
                    defaults={
                        "name": each["Name"],
                        "trade_type": TradeType.TSE,
                    },
                )
                StockInfo.objects.update_or_create(
                    company=c,
                    defaults={
                        "date": date,
                        "quantity": int(each["TradeVolume"] or 0),
                        "close_price": round(
                            float(each["ClosingPrice"] or each["HighestPrice"] or 0),
                            2,
                        ),
                        "fluct_price": round(float(each["Change"] or 0), 2),
                    },
                )
            except:
                continue
    except Exception as e:
        print(str(e))

    try:
        res_otc = requests.get(InfoEndpoint.endpoints["single_day"]["otc"]).json()
        for each in res_otc:
            try:
                c, created = Company.objects.update_or_create(
                    pk=each["SecuritiesCompanyCode"],
                    defaults={
                        "name": each["CompanyName"],
                        "trade_type": TradeType.OTC,
                    },
                )
                StockInfo.objects.update_or_create(
                    company=c,
                    defaults={
                        "date": date,
                        "quantity": int(
                            each["TradingShares"]
                            if each["TradingShares"].find("--") == -1
                            else 0
                        ),
                        "close_price": round(
                            float(
                                each["Close"]
                                if each["Close"].find("--") == -1
                                else (
                                    each["High"] if each["High"].find("--") == -1 else 0
                                )
                            ),
                            2,
                        ),
                        "fluct_price": round(
                            float(
                                each["Change"] if each["Change"].find("--") == -1 else 0
                            ),
                            2,
                        ),
                    },
                )
            except:
                continue
    except Exception as e:
        print(str(e))
    print("Stock Info Updated")


def fetch_stock_info_periodically():
    DjangoJobExecution.objects.delete_old_job_executions(0)
    scheduler = BackgroundScheduler(timezone=settings.TIME_ZONE)
    scheduler.add_jobstore(DjangoJobStore(), "default")
    scheduler.remove_all_jobs()
    scheduler.add_job(
        fetch_and_store_latest_day_info,
        trigger=CronTrigger.from_crontab("0 14 * * MON-FRI"),
        id="fetch_and_store_latest_day_info",
        max_instances=1,
        replace_existing=True,
    )
    scheduler.add_job(
        fetch_and_store_real_time_info,
        trigger=CronTrigger.from_crontab("0/5 9-14 * * MON-FRI"),
        id="fetch_and_store_real_time_info",
        max_instances=1,
        replace_existing=True,
    )
    scheduler.start()
