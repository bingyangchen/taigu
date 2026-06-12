import logging
from datetime import datetime

from django.db.models import Q
from django.http import HttpRequest, JsonResponse
from django.views.decorators.http import require_GET

from main.core.decorators.auth import require_login
from main.core.decorators.rate_limit import rate_limit
from main.market import Frequency, TradeType
from main.market.cache import TimeSeriesStockInfo, TimeSeriesStockInfoCacheManager
from main.market.models import (
    Company,
    History,
    MarketIndexHistory,
    MarketIndexPerMinute,
    StockInfo,
    StockPricePerMinute,
)

logger = logging.getLogger(__name__)


@rate_limit(rate=2)
@require_GET
@require_login
def market_index(request: HttpRequest) -> JsonResponse:
    result: dict = {"date": None}
    for market_id in (TradeType.TSE, TradeType.OTC):
        if (cache_result := TimeSeriesStockInfoCacheManager.get(market_id)) is not None:
            data: dict = cache_result.model_dump()["data"]
        else:
            data = {
                row["number"]: {
                    "date": row["date"],
                    "price": row["price"],
                    "fluct_price": row["fluct_price"],
                }
                for row in MarketIndexPerMinute.objects.filter(market=market_id).values(
                    "number", "date", "price", "fluct_price"
                )
            }
            TimeSeriesStockInfoCacheManager.set(
                market_id, TimeSeriesStockInfo.model_validate({"data": data}), 300
            )
        data = dict(sorted(data.items(), key=lambda item: item[0], reverse=True))
        result[market_id] = {k: v["price"] for k, v in data.items()}
        result[market_id]["yesterday_price"] = 0
        result[market_id]["last_fluct_price"] = 0
        if last := (next(iter(data.values())) if data else None):
            result["date"] = last["date"]
            result[market_id]["yesterday_price"] = last["price"] - last["fluct_price"]
            result[market_id]["last_fluct_price"] = last["fluct_price"]
    return JsonResponse(result)


@rate_limit(rate=3)
@require_GET
@require_login
def current_stock_info(request: HttpRequest) -> JsonResponse:
    result = {}
    sids = [sid for sid in request.GET.get("sids", "").strip(",").split(",") if sid]
    for info in StockInfo.objects.filter(company__pk__in=sids).select_related(
        "company"
    ):
        result[info.company.pk] = {
            "sid": info.company.pk,
            "name": info.company.name,
            "quantity": info.quantity,
            "close": info.close_price,
            "fluct_price": info.fluct_price,
        }
    return JsonResponse(result)


@rate_limit(rate=2)
@require_GET
@require_login
def market_index_historical_prices(request: HttpRequest) -> JsonResponse:
    market = request.GET.get("market")
    if not market:
        return JsonResponse({"error": "Missing market"}, status=400)
    if market not in TradeType.ALL:
        return JsonResponse({"error": "Invalid market"}, status=400)

    queryset = MarketIndexHistory.objects.filter(market=market)
    if since := request.GET.get("since"):
        try:
            since_date = datetime.strptime(since, "%Y-%m-%d").date()
        except ValueError:
            return JsonResponse({"error": "Invalid since"}, status=400)
        queryset = queryset.filter(date__gte=since_date)

    result = {"data": []}
    for row in queryset.order_by("date"):
        result["data"].append({"date": row.date, "price": row.close_price})
    return JsonResponse(result)


@rate_limit(rate=3)
@require_GET
@require_login
def intraday_prices(request: HttpRequest) -> JsonResponse:
    if not (sid := request.GET.get("sid")):
        return JsonResponse({"error": "Missing sid"}, status=400)

    if Company.objects.filter(pk=sid).first() is None:
        return JsonResponse({"error": "Unknown Stock ID"}, status=400)

    if (cache_result := TimeSeriesStockInfoCacheManager.get(sid)) is not None:
        data: dict = cache_result.model_dump()["data"]
    else:
        data = {
            row["number"]: {
                "date": row["date"],
                "price": row["price"],
                "fluct_price": row["fluct_price"],
            }
            for row in StockPricePerMinute.objects.filter(company_id=sid).values(
                "number", "date", "price", "fluct_price"
            )
        }
        TimeSeriesStockInfoCacheManager.set(
            sid, TimeSeriesStockInfo.model_validate({"data": data}), 300
        )

    sorted_data = dict(sorted(data.items(), key=lambda item: item[0], reverse=True))
    result: dict = {
        "date": None,
        "yesterday_price": 0,
        "last_fluct_price": 0,
        **{str(number): point["price"] for number, point in sorted_data.items()},
    }
    if last := (next(iter(sorted_data.values())) if sorted_data else None):
        result["date"] = last["date"]
        result["yesterday_price"] = last["price"] - last["fluct_price"]
        result["last_fluct_price"] = last["fluct_price"]
    return JsonResponse(result)


@rate_limit(rate=3)
@require_GET
@require_login
def historical_prices(request: HttpRequest) -> JsonResponse:
    if not (sid := request.GET.get("sid")):
        return JsonResponse({"error": "Missing sid"}, status=400)

    company = Company.objects.filter(pk=sid).first()
    if company is None:
        return JsonResponse({"error": "Unknown Stock ID"}, status=400)

    result = {"data": []}
    for h in History.objects.filter(
        company=company, frequency=request.GET.get("frequency", Frequency.DAILY)
    ):
        result["data"].append({"date": h.date, "price": h.close_price})
    return JsonResponse(result)


@rate_limit(rate=3)
@require_GET
@require_login
def search(request: HttpRequest) -> JsonResponse:
    result = {"data": []}
    if keyword := request.GET.get("keyword"):
        for info in StockInfo.objects.filter(
            Q(company__pk__icontains=keyword) | Q(company__name__icontains=keyword)
        ).select_related("company")[:30]:
            result["data"].append(
                {
                    "sid": info.company.pk,
                    "name": info.company.name,
                    "quantity": info.quantity,
                    "close": info.close_price,
                    "fluct_price": info.fluct_price,
                }
            )
    return JsonResponse(result)


@rate_limit(rate=2)
@require_GET
@require_login
def company_names(request: HttpRequest) -> JsonResponse:
    sids = [sid for sid in request.GET.get("sids", "").strip(",").split(",") if sid]
    result = dict.fromkeys(sids, None)
    for company in Company.objects.filter(stock_id__in=sids):
        result[company.stock_id] = company.name
    return JsonResponse(result)
