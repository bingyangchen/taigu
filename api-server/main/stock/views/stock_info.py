import logging

from django.db.models import Q
from django.http import HttpRequest, JsonResponse
from django.views.decorators.http import require_GET

from main.stock import Frequency, TradeType
from main.stock.cache import TimeSeriesStockInfo, TimeSeriesStockInfoCacheManager
from main.stock.models import Company, History, MarketIndexPerMinute, StockInfo

logger = logging.getLogger(__name__)


@require_GET
def market_index(request: HttpRequest) -> JsonResponse:
    result = {}
    for market_id in (TradeType.TSE, TradeType.OTC):
        cache_manager = TimeSeriesStockInfoCacheManager()
        cache_result = cache_manager.get(market_id)
        if cache_result is not None:
            data = cache_result.model_dump()["data"]
        else:
            data = {
                row.number: {
                    "date": row.date,
                    "price": row.price,
                    "fluct_price": row.fluct_price,
                }
                for row in MarketIndexPerMinute.objects.filter(market=market_id)
            }
            cache_manager.set(
                market_id, TimeSeriesStockInfo.model_validate({"data": data}), 180
            )
        result[market_id] = data
    return JsonResponse(result)


@require_GET
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


@require_GET
def historical_prices(request: HttpRequest, sid: str) -> JsonResponse:
    result = {"data": []}
    for h in History.objects.filter(
        company=Company.objects.get(pk=sid),
        frequency=request.GET.get("frequency", Frequency.DAILY),
    ):
        result["data"].append({"date": h.date, "price": h.close_price})
    return JsonResponse(result)


@require_GET
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
