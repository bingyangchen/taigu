import csv
import logging
import math
from datetime import date, datetime, time, timedelta, timezone
from io import StringIO
from time import sleep
from typing import Literal

import requests
import urllib3
from dateutil.relativedelta import relativedelta
from requests import ConnectTimeout, JSONDecodeError, ReadTimeout

from main.stock import Frequency, ThirdPartyApi, TradeType
from main.stock.cache import (
    TimeSeriesStockInfo,
    TimeSeriesStockInfoCacheManager,
    TimeSeriesStockInfoPointData,
)
from main.stock.models import (
    Company,
    History,
    MarketIndexPerMinute,
    MaterialFact,
    StockInfo,
)

logger = logging.getLogger(__name__)
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)


def fetch_and_store_realtime_stock_info() -> None:
    logger.debug("Start fetching realtime sotck info.")
    market_indices = ("t00", "o00")
    query_set = Company.objects.filter(trade_type__isnull=False).values(
        "pk", "trade_type"
    )
    all = [f"tse_{market_indices[0]}.tw", f"otc_{market_indices[1]}.tw"] + list(
        map(lambda x: f"{x['trade_type']}_{x['pk']}.tw", query_set)
    )
    batch_size = 145
    logger.debug(f"Expected request count: {math.ceil(len(all) / batch_size)}")
    while len(all) > 0:
        start = datetime.now()
        url = f"{ThirdPartyApi.realtime['stock']}{'|'.join(all[:batch_size])}"
        try:
            json_data = requests.get(url, timeout=4, verify=False).json()
            to_update_batch = []
            for row in json_data["msgArray"]:
                try:
                    # parse row data
                    company_id = row["c"]
                    if not company_id:
                        continue
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
                            _store_market_per_minute_info(
                                id=company_id,
                                date_=date_,
                                price=price,
                                fluct_price=fluct_price,
                            )
                        else:
                            to_update_batch.append(
                                StockInfo(
                                    company_id=company_id,
                                    date=date_,
                                    quantity=quantity,
                                    close_price=price,
                                    fluct_price=fluct_price,
                                )
                            )
                except Exception as e:
                    logger.error(f"<{type(e).__name__}>: {e}")
                    logger.error(f"Row: {row}")
                    continue
            StockInfo.objects.bulk_create(
                to_update_batch,
                update_conflicts=True,
                update_fields=["date", "quantity", "close_price", "fluct_price"],
                unique_fields=["company_id"],
            )
        except ReadTimeout:
            logger.warning("ReadTimeout")
        except ConnectTimeout:
            logger.warning("ConnectTimeout")
        except JSONDecodeError:
            logger.warning("JSONDecodeError")
        except Exception as e:
            logger.error(f"<{type(e).__name__}>: {e}")
            logger.error(f"URL: {url}")
        finally:
            all = all[batch_size:]

            # API rate limit: 3 requests per 5 seconds
            sleep(max(0, 2 - (datetime.now() - start).total_seconds()))
    logger.debug("All realtime stock info updated!")


def _store_market_per_minute_info(
    id: Literal["t00", "o00"], date_: date, price: float, fluct_price: float
) -> None:
    now = (datetime.now(timezone.utc) + timedelta(hours=8)).time()
    minutes_after_opening = (now.hour - 9) * 60 + now.minute

    # Do nothing during 13:30 ~ 13:58
    if 269 < minutes_after_opening < 298:
        return

    # Convert the last few minutes to 270
    if minutes_after_opening >= 298:
        minutes_after_opening = 270

    market_id = TradeType.TSE if id == "t00" else TradeType.OTC

    # Delete data that are not belong to the latest day
    delete_count, _ = (
        MarketIndexPerMinute.objects.filter(market=market_id)
        .exclude(date=date_)
        .delete()
    )

    cache_manager = TimeSeriesStockInfoCacheManager(market_id)
    current_data_to_cache = {
        minutes_after_opening: TimeSeriesStockInfoPointData(
            date=date_, price=price, fluct_price=fluct_price
        )
    }
    if delete_count == 0 and (cache_data := cache_manager.get()) is not None:
        current_data_to_cache.update(cache_data.model_dump()["data"])
    cache_manager.set(TimeSeriesStockInfo(data=current_data_to_cache), 180)

    MarketIndexPerMinute.objects.get_or_create(
        market=market_id,
        date=date_,
        number=minutes_after_opening,
        defaults={"price": price, "fluct_price": fluct_price},
    )


def fetch_and_store_close_info_today() -> None:
    """This function is currently not used."""
    logger.debug("Start fetching sotck market close info today.")
    date_ = (datetime.now(timezone.utc) + timedelta(hours=8)).date()

    # Process TSE stocks
    try:
        tse_response: list[dict[str, str]] = requests.get(
            ThirdPartyApi.single_day[TradeType.TSE]
        ).json()
        for row in tse_response:
            try:
                company, created = Company.objects.get_or_create(pk=row["Code"])
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
                logger.error(f"<{type(e).__name__}>: {e}")
                logger.error(f"Row: {row}")
                continue
    except Exception as e:
        logger.error(f"<{type(e).__name__}>: {e}")

    # Process OTC stocks
    try:
        otc_response: list[dict[str, str]] = requests.get(
            ThirdPartyApi.single_day[TradeType.OTC]
        ).json()
        for row in otc_response:
            try:
                company, created = Company.objects.get_or_create(
                    pk=row["SecuritiesCompanyCode"]
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
                logger.error(f"<{type(e).__name__}>: {e}")
                logger.error(f"Row: {row}")
                continue
    except Exception as e:
        logger.error(f"<{type(e).__name__}>: {e}")
    logger.debug(f"Stock market close info of {datetime.now().date()} is up to date!")


def _fetch_and_store_historical_info_from_yahoo(
    company: Company, frequency: str
) -> None:
    """This function is currently not used."""
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
        f"{ThirdPartyApi.multiple_days}{company.pk}.{'TW' if company.trade_type == TradeType.TSE else 'TWO'}?period1={int(start.timestamp())}&period2={int(end.timestamp())}&interval={interval}&events=history&includeAdjustedClose=true",  # noqa: E501
        headers=headers,
    )
    data = StringIO(response.text)
    csv_reader = csv.reader(data)
    History.objects.filter(company=company, frequency=frequency).delete()
    previous_quantity = None
    previous_close_price = None
    to_create_batch = []
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
                to_create_batch.append(
                    History(
                        company_id=company.pk,
                        frequency=frequency,
                        date=datetime.strptime(row[0], "%Y-%m-%d").date(),
                        quantity=quantity,
                        close_price=close_price,
                    )
                )
    History.objects.bulk_create(
        to_create_batch,
        update_conflicts=True,
        update_fields=["quantity", "close_price"],
        unique_fields=["company_id", "frequency", "date"],
    )


def update_all_stocks_history() -> None:
    to_create_batch = [
        History(
            company_id=stock_info.company.pk,
            frequency=Frequency.DAILY,
            date=stock_info.date,
            quantity=stock_info.quantity,
            close_price=stock_info.close_price,
        )
        for stock_info in StockInfo.objects.filter(date=date.today()).select_related(
            "company"
        )
    ]
    History.objects.bulk_create(
        to_create_batch,
        update_conflicts=True,
        update_fields=["quantity", "close_price"],
        unique_fields=["company_id", "frequency", "date"],
    )
    History.objects.filter(date__lt=date.today() - timedelta(days=80)).delete()


def update_material_facts() -> None:
    logger.debug("Start fetching material facts.")
    for trade_type in [TradeType.TSE, TradeType.OTC]:
        try:
            response: list[dict[str, str]] = requests.get(
                ThirdPartyApi.material_fact[trade_type]
            ).json()

            # Fill the data of missed companies
            stock_id_key = (
                "公司代號" if trade_type == TradeType.TSE else "SecuritiesCompanyCode"
            )
            stock_id_set = {row[stock_id_key] for row in response}
            for stock_id in stock_id_set - {
                row["pk"]
                for row in Company.objects.filter(pk__in=stock_id_set).values("pk")
            }:
                # Do not use bulk_create because only get_or_create will automatically
                # fetch company info.
                Company.objects.get_or_create(pk=stock_id)
                sleep(0.5)

            MaterialFact.objects.bulk_create(
                [
                    MaterialFact(
                        company_id=row[stock_id_key],
                        date_time=datetime.combine(
                            roc_date_string_to_date(row["發言日期"]),
                            time(
                                int(row["發言時間"][-6:-4] or 0),
                                int(row["發言時間"][-4:-2] or 0),
                                int(row["發言時間"][-2:] or 0),
                            ),
                            tzinfo=timezone(timedelta(hours=8)),
                        ),
                        title=row["主旨 " if trade_type == TradeType.TSE else "主旨"],
                        description=row["說明"],
                    )
                    for row in response
                ],
                update_conflicts=True,
                update_fields=["title", "description"],
                unique_fields=["company_id", "date_time"],
            )
        except Exception as e:
            logger.error(f"<{type(e).__name__}>: {e}")

    # Delete data that is too old
    MaterialFact.objects.filter(
        date_time__lt=(datetime.now(timezone.utc) + timedelta(hours=8))
        - timedelta(days=30)
    ).delete()
    logger.debug("Material facts updated!")


def roc_date_string_to_date(roc_date_string: str) -> date:
    return datetime(
        int(roc_date_string[:3]) + 1911,
        int(roc_date_string[3:5]),
        int(roc_date_string[5:]),
    ).date()
