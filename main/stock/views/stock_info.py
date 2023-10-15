from django.http import HttpRequest, JsonResponse
from django.views.decorators.http import require_GET

from .. import Frequency
from ..models import Company, History, StockInfo


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
