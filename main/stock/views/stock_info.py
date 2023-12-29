from django.db.models import Q
from django.http import HttpRequest, JsonResponse
from django.views.decorators.http import require_GET

from .. import Frequency, TradeType
from ..models import Company, History, MarketIndexPerMinute, StockInfo


@require_GET
def latest_market_index(request: HttpRequest):
    result = {"success": False, "data": {}}
    try:
        all_data = MarketIndexPerMinute.objects.all()
        result["data"]["tse"] = {
            row.number: {
                "date": row.date,
                "price": row.price,
                "fluct_price": row.fluct_price,
            }
            for row in all_data
            if row.market == TradeType.TSE
        }
        result["data"]["otc"] = {
            row.number: {
                "date": row.date,
                "price": row.price,
                "fluct_price": row.fluct_price,
            }
            for row in all_data
            if row.market == TradeType.OTC
        }
        result["success"] = True
    except Exception as e:
        result["error"] = str(e)
    return JsonResponse(result)


@require_GET
def multiple_companies_single_day(request: HttpRequest):
    result = {"success": False, "data": []}
    try:
        sids = [sid for sid in request.GET.get("sids", "").strip(",").split(",") if sid]
        for info in StockInfo.objects.filter(company__pk__in=sids):
            result["data"].append(
                {
                    "sid": info.company.pk,
                    "name": info.company.name,
                    "quantity": info.quantity,
                    "close": info.close_price,
                    "fluct_price": info.fluct_price,
                }
            )
        result["success"] = True
    except Exception as e:
        result["error"] = str(e)
    return JsonResponse(result)


@require_GET
def single_company_multiple_days(request: HttpRequest, sid: str):
    result = {"success": False, "data": []}
    try:
        frequency = request.GET.get("frequency", Frequency.DAILY)
        if company := Company.objects.filter(pk=sid).first():
            for h in History.objects.filter(company=company, frequency=frequency):
                result["data"].append({"date": h.date, "price": h.close_price})
        result["success"] = True
    except Exception as e:
        result["error"] = str(e)
    return JsonResponse(result)


@require_GET
def search(request: HttpRequest):
    result = {"success": False, "data": []}
    try:
        if keyword := request.GET.get("keyword"):
            for info in StockInfo.objects.filter(
                Q(company__pk__icontains=keyword) | Q(company__name__icontains=keyword)
            )[:30]:
                result["data"].append(
                    {
                        "sid": info.company.pk,
                        "name": info.company.name,
                        "quantity": info.quantity,
                        "close": info.close_price,
                        "fluct_price": info.fluct_price,
                    }
                )
        result["success"] = True
    except Exception as e:
        result["error"] = str(e)
    return JsonResponse(result)
