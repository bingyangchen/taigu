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


def fetch_and_store_latest_day_info():
    print("start")
    date = (datetime.datetime.now(pytz.utc) + datetime.timedelta(hours=8)).date()
    current_hour = int(
        (datetime.datetime.now(pytz.utc) + datetime.timedelta(hours=8)).strftime("%H")
    )
    if current_hour < 14:
        date -= datetime.timedelta(days=1)

    res_tse = requests.get(InfoEndpoint.endpoints["single_day"]["tse"]).json()
    res_otc = requests.get(InfoEndpoint.endpoints["single_day"]["otc"]).json()
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
        except Exception as e:
            continue
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
                            else (each["High"] if each["High"].find("--") == -1 else 0)
                        ),
                        2,
                    ),
                    "fluct_price": round(
                        float(each["Change"] if each["Change"].find("--") == -1 else 0),
                        2,
                    ),
                },
            )
        except Exception as e:
            continue
    print("end")


def fetch_stock_info_periodically():
    DjangoJobExecution.objects.delete_old_job_executions(0)
    scheduler = BackgroundScheduler(timezone=settings.TIME_ZONE)
    scheduler.add_jobstore(DjangoJobStore(), "default")
    scheduler.remove_all_jobs()
    scheduler.add_job(
        fetch_and_store_latest_day_info,
        trigger=CronTrigger.from_crontab("* 9-14 * * MON-FRI"),
        id="fetch_stock_info_periodically",
        max_instances=1,
        replace_existing=True,
    )
    scheduler.start()
