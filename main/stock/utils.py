import csv
import math
from contextlib import suppress
from datetime import date, datetime, timedelta
from io import StringIO
from time import sleep
from typing import Literal

import pytz
import requests
from dateutil.relativedelta import relativedelta

from . import Frequency, InfoEndpoint, TradeType
from .models import Company, History, MarketIndexPerMinute, StockInfo


def fetch_and_store_realtime_stock_info() -> None:
    print(
        f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] Start fetching realtime sotck info!"
    )
    market_indices = ["t00", "o00"]
    query_set = Company.objects.filter(trade_type__isnull=False).values(
        "pk", "trade_type"
    )
    all = [f"tse_{market_indices[0]}.tw", f"otc_{market_indices[1]}.tw"] + list(
        map(lambda x: f"{x['trade_type']}_{x['pk']}.tw", query_set)
    )
    batch_size = 145
    print(f"Expected request count: {math.ceil(len(all) / batch_size)}")
    while len(all) > 0:
        start = datetime.now()
        url = f"{InfoEndpoint.realtime['stock']}{'|'.join(all[:batch_size])}"
        try:
            response = requests.get(url, timeout=4)
            json_data = response.json()
            for row in json_data["msgArray"]:
                try:
                    # parse row data
                    company_id = row["c"]
                    date_ = datetime.strptime(row["d"], "%Y%m%d").date()
                    quantity = (
                        int(row["v"]) * 1000
                        if row.get("v") is not None and row["v"] != "-"
                        else 0
                    )
                    yesterday_price = (
                        round(float(row["y"]), 2)
                        if row.get("y") is not None and row["y"] != "-"
                        else 0.0
                    )
                    current_dealt_price = (
                        round(float(row["z"]), 2)
                        if row.get("z") is not None and row["z"] != "-"
                        else None
                    )
                    lowest_ask_price = (
                        round(
                            min(
                                float(price_str)
                                for price_str in row["a"].split("_")
                                if price_str
                            ),
                            2,
                        )
                        if row.get("a") is not None and row["a"] != "-"
                        else None
                    )
                    highest_bid_price = (
                        round(
                            max(
                                float(price_str)
                                for price_str in row["b"].split("_")
                                if price_str
                            ),
                            2,
                        )
                        if row.get("b") is not None and row["b"] != "-"
                        else None
                    )
                    price_upper_bound = (
                        round(float(row["u"]), 2)
                        if row.get("u") is not None and row["u"] != "-"
                        else None
                    )
                    price_lower_bound = (
                        round(float(row["w"]), 2)
                        if row.get("w") is not None and row["w"] != "-"
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

                    fluct_price = round(price - yesterday_price, 2)
                    if date.today() == date_:  # do nothing if market is not opened
                        if company_id in market_indices:
                            store_market_per_minute_info(
                                id=company_id,
                                date_=date_,
                                price=price,
                                fluct_price=fluct_price,
                            )
                        else:
                            StockInfo.objects.update_or_create(
                                company=Company.objects.get(pk=company_id),
                                defaults={
                                    "date": date_,
                                    "quantity": quantity,
                                    "close_price": price,
                                    "fluct_price": fluct_price,
                                },
                            )
                except Exception as e:
                    print(e)
                    continue
            print(".", end="")
        except Exception as e:
            print(e)
        finally:
            all = all[batch_size:]

            # deal with rate limit (3 requests per 5 seconds)
            sleep(max(0, 2 - (datetime.now() - start).total_seconds()))
    print(
        f"\n[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] All realtime stock info updated!"
    )


def store_market_per_minute_info(
    id: Literal["t00", "o00"], date_: date, price: float, fluct_price: float
) -> None:
    now = (datetime.now(pytz.utc) + timedelta(hours=8)).time()
    minutes_after_opening = (now.hour - 9) * 60 + now.minute

    # Do nothing during 13:30 ~ 13:58
    if 269 < minutes_after_opening < 298:
        return

    # Convert the last few minutes to 270
    if minutes_after_opening >= 298:
        minutes_after_opening = 270

    market = TradeType.TSE if id == "t00" else TradeType.OTC

    # Delete data that are not belong to the latest day
    MarketIndexPerMinute.objects.filter(market=market).exclude(date=date_).delete()

    MarketIndexPerMinute.objects.get_or_create(
        market=market,
        date=date_,
        number=minutes_after_opening,
        defaults={"price": price, "fluct_price": fluct_price},
    )


def fetch_and_store_close_info_today() -> None:
    print(
        f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] Start fetching sotck market close info today!"
    )
    date_ = (datetime.now(pytz.utc) + timedelta(hours=8)).date()

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
                        "date": date_,
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
                        "date": date_,
                        "quantity": int(
                            row["TradingShares"]
                            if "--" not in row["TradingShares"]
                            else 0
                        ),
                        "close_price": round(
                            float(
                                row["Close"]
                                if "--" not in row["Close"]
                                else (row["High"] if "--" not in row["High"] else 0)
                            ),
                            2,
                        ),
                        "fluct_price": round(
                            float(
                                row["Change"]
                                if "--" not in row["Change"]
                                and "除息" not in row["Change"]
                                else 0
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
    end = datetime.now()
    print(f"[{end}] Stock market close info of {end.date()} is up to date!")


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
    previous_quantity = None
    previous_close_price = None
    for row in csv_reader:
        # ['Date', 'Open', 'High', 'Low', 'Close', 'Adj Close', 'Volume']
        if "Date" not in row:  # skip the header row
            try:
                quantity = int(row[-1])
            except Exception:
                quantity = previous_quantity
            try:
                close_price = round(float(row[4]), 2)
            except Exception:
                close_price = previous_close_price
            if quantity is not None and close_price is not None:
                History.objects.create(
                    company=company,
                    frequency=frequency,
                    date=datetime.strptime(row[0], "%Y-%m-%d").date(),
                    quantity=quantity,
                    close_price=close_price,
                )


def update_all_stocks_history() -> None:
    print(
        f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] Start fetching historical price for all stocks!"
    )
    for company in Company.objects.filter(trade_type__isnull=False):
        start = datetime.now()
        with suppress(Exception):
            fetch_and_store_historical_info_yahoo(
                company=company, frequency=Frequency.DAILY
            )

        # deal with rate limit (3000 per hour)
        sleep(max(0, 2 - (datetime.now() - start).total_seconds()))
    print(
        f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] All historical price updated!"
    )
