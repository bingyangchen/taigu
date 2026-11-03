import csv
import logging
import math
from datetime import UTC, date, datetime, time, timedelta
from datetime import timezone as stdlib_timezone
from io import StringIO
from time import sleep
from typing import Literal

import requests
import urllib3
from dateutil.relativedelta import relativedelta
from django.db import transaction
from django.utils import timezone
from requests import ConnectTimeout, JSONDecodeError, ReadTimeout

from main.market import Frequency, ThirdPartyApi, TradeType
from main.market.cache import (
    TimeSeriesStockInfo,
    TimeSeriesStockInfoCacheManager,
    TimeSeriesStockInfoPointData,
)
from main.market.models import (
    Company,
    History,
    MarketIndexHistory,
    MarketIndexPerMinute,
    MaterialFact,
    StockInfo,
    StockPricePerMinute,
)

logger = logging.getLogger(__name__)
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)


def fetch_and_store_realtime_stock_info() -> None:
    batch_size = 145
    market_indices = ("t00", "o00")

    logger.info("Start fetching realtime sotck info.")
    query_set = Company.objects.filter(trade_type__isnull=False).values(
        "pk", "trade_type"
    )
    all = [f"tse_{market_indices[0]}.tw", f"otc_{market_indices[1]}.tw"] + [
        f"{x['trade_type']}_{x['pk']}.tw" for x in query_set
    ]
    logger.info(f"Expected request count: {math.ceil(len(all) / batch_size)}")
    while len(all) > 0:
        start = datetime.now()
        url = f"{ThirdPartyApi.realtime['stock']}{'|'.join(all[:batch_size])}"
        try:
            json_data = requests.get(url, timeout=(2, 8), verify=False).json()  # noqa: S501
            to_update_batch = []
            to_store_stock_price_batch = []
            intraday_slot_number = _get_intraday_five_minute_slot(timezone.localtime())
            for row in json_data["msgArray"]:
                try:
                    company_id = row["c"]
                    if not company_id:
                        continue
                    date_ = datetime.strptime(row["d"], "%Y%m%d").date()
                    quantity = (
                        int(v) * 1000 if (v := row.get("v")) not in (None, "-") else 0
                    )
                    yesterday_price = (
                        round(float(y), 2)
                        if (y := row.get("y")) not in (None, "-")
                        else 0.0
                    )
                    current_dealt_price = (
                        round(float(z), 2)
                        if (z := row.get("z")) not in (None, "-")
                        else None
                    )
                    lowest_ask_price = (
                        round(min(map(float, filter(None, a.split("_")))), 2)
                        if (a := row.get("a")) not in (None, "-")
                        else None
                    )
                    highest_bid_price = (
                        round(max(map(float, filter(None, b.split("_")))), 2)
                        if (b := row.get("b")) not in (None, "-")
                        else None
                    )
                    price_upper_bound = (
                        round(float(u), 2)
                        if (u := row.get("u")) not in (None, "-")
                        else None
                    )
                    price_lower_bound = (
                        round(float(w), 2)
                        if (w := row.get("w")) not in (None, "-")
                        else None
                    )

                    # Determine the realtime price
                    price = 0.0
                    if current_dealt_price:
                        price = current_dealt_price
                    elif lowest_ask_price and highest_bid_price:
                        price = round((lowest_ask_price + highest_bid_price) / 2, 2)
                    elif highest_bid_price and price_upper_bound:
                        price = price_upper_bound
                    elif lowest_ask_price and price_lower_bound:
                        price = price_lower_bound
                    elif yesterday_price:
                        price = yesterday_price

                    # Do nothing if market is not opened or price is not available
                    if date.today() == date_ and price:
                        fluct_price = round(price - yesterday_price, 2)
                        if company_id in market_indices:
                            _store_market_index_per_minute(
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
                            if intraday_slot_number is not None:
                                to_store_stock_price_batch.append(
                                    StockPricePerMinute(
                                        company_id=company_id,
                                        date=date_,
                                        number=intraday_slot_number,
                                        price=price,
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
            _bulk_store_stock_price_per_minute(to_store_stock_price_batch)
        except ConnectTimeout:
            logger.warning("ConnectTimeout")
        except ReadTimeout:
            logger.warning("ReadTimeout")
        except JSONDecodeError:
            logger.warning("JSONDecodeError")
        except Exception as e:
            logger.error(f"<{type(e).__name__}>: {e}")
            logger.error(f"URL: {url}")
        finally:
            all = all[batch_size:]

            # API rate limit: 3 requests per 5 seconds
            if all:
                sleep(max(0, 2 - (datetime.now() - start).total_seconds()))
    logger.info("All realtime stock info updated!")


def _get_minutes_after_opening(now: datetime) -> int | None:
    minutes_after_opening = (now.hour - 9) * 60 + now.minute
    if minutes_after_opening < 0 or (270 < minutes_after_opening < 298):
        return None
    return min(minutes_after_opening, 270)


def _get_intraday_five_minute_slot(now: datetime) -> int | None:
    minutes_after_opening = _get_minutes_after_opening(now)
    if minutes_after_opening is None:
        return None
    return math.ceil(minutes_after_opening / 5) * 5


def _bulk_store_stock_price_per_minute(
    to_store_batch: list[StockPricePerMinute],
) -> None:
    if not to_store_batch:
        return

    company_ids = list({record.company_id for record in to_store_batch})
    trading_date = to_store_batch[0].date
    with transaction.atomic():
        StockPricePerMinute.objects.filter(company_id__in=company_ids).exclude(
            date=trading_date
        ).delete()
        StockPricePerMinute.objects.bulk_create(
            to_store_batch,
            update_conflicts=True,
            update_fields=["price", "fluct_price"],
            unique_fields=["company_id", "date", "number"],
        )
    TimeSeriesStockInfoCacheManager.delete_many(company_ids)


def _store_market_index_per_minute(
    id: Literal["t00", "o00"], date_: date, price: float, fluct_price: float
) -> None:
    minutes_after_opening = _get_minutes_after_opening(timezone.localtime())
    if minutes_after_opening is None:
        return

    market_id = TradeType.TSE if id == "t00" else TradeType.OTC

    delete_count, _ = (
        MarketIndexPerMinute.objects.filter(market=market_id)
        .exclude(date=date_)
        .delete()
    )
    if delete_count:
        TimeSeriesStockInfoCacheManager.delete(market_id)
    elif (
        previous_cache_data := TimeSeriesStockInfoCacheManager.get(market_id)
    ) is not None:
        current_data_to_cache = {
            minutes_after_opening: TimeSeriesStockInfoPointData(
                date=date_, price=price, fluct_price=fluct_price
            )
        }
        current_data_to_cache.update(previous_cache_data.model_dump()["data"])
        TimeSeriesStockInfoCacheManager.set(
            market_id, TimeSeriesStockInfo(data=current_data_to_cache), 300
        )

    MarketIndexPerMinute.objects.get_or_create(
        market=market_id,
        date=date_,
        number=minutes_after_opening,
        defaults={"price": price, "fluct_price": fluct_price},
    )


def update_company_list() -> None:
    logger.info("Start updating company list.")

    today = date.today()
    new_sids = []
    to_create_stock_info = []
    for trade_type in (TradeType.TSE, TradeType.OTC):
        try:
            response: list[dict[str, str]] = requests.get(
                ThirdPartyApi.single_day[trade_type],
                verify=False,  # noqa: S501
                timeout=10,
            ).json()
            incoming_sids = {
                (row.get("SecuritiesCompanyCode") or row.get("Code"))
                for row in response
            }
            existing_sids = {
                c.pk for c in Company.objects.filter(trade_type=trade_type)
            }
            for sid in incoming_sids - existing_sids:
                try:
                    _c, created = Company.objects.get_or_create(pk=sid)
                    if created:
                        to_create_stock_info.append(
                            StockInfo(
                                company_id=sid,
                                date=today,
                                quantity=0,
                                close_price=0,
                                fluct_price=0,
                            )
                        )
                        new_sids.append(sid)
                except Exception as e:
                    logger.error(f"<{type(e).__name__}>: {e}")
                finally:
                    sleep(1.5)
        except Exception as e:
            logger.error(f"<{type(e).__name__}>: {e}")

    StockInfo.objects.bulk_create(
        to_create_stock_info,
        ignore_conflicts=True,
        update_fields=["date", "quantity", "close_price", "fluct_price"],
        unique_fields=["company_id"],
    )

    logger.info(f"New company list: {new_sids}")
    logger.info("Company list updated!")


def _fetch_and_store_historical_info_from_yahoo(
    company: Company, frequency: str
) -> None:
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
        verify=False,  # noqa: S501
        timeout=10,
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


def update_market_indices_history() -> None:
    today = date.today()
    to_create_batch = []
    for market_id in (TradeType.TSE, TradeType.OTC):
        row = (
            MarketIndexPerMinute.objects.filter(market=market_id, date=today)
            .order_by("-number")
            .values("price", "date")
            .first()
        )
        if row is not None:
            to_create_batch.append(
                MarketIndexHistory(
                    market=market_id, date=row["date"], close_price=row["price"]
                )
            )
    MarketIndexHistory.objects.bulk_create(
        to_create_batch,
        update_conflicts=True,
        update_fields=["close_price"],
        unique_fields=["market", "date"],
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
    update_market_indices_history()


def update_material_facts() -> None:
    logger.info("Start fetching material facts.")
    for trade_type in [TradeType.TSE, TradeType.OTC]:
        try:
            response: list[dict[str, str]] = requests.get(
                ThirdPartyApi.material_fact[trade_type],
                verify=False,  # noqa: S501
                timeout=10,
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
                            tzinfo=stdlib_timezone(timedelta(hours=8)),
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
        date_time__lt=(datetime.now(UTC) + timedelta(hours=8)) - timedelta(days=30)
    ).delete()
    logger.info("Material facts updated!")


def roc_date_string_to_date(roc_date_string: str) -> date:
    return datetime(
        int(roc_date_string[:3]) + 1911,
        int(roc_date_string[3:5]),
        int(roc_date_string[5:]),
    ).date()
