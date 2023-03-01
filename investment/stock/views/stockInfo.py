from django.http import JsonResponse, HttpRequest
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_GET

from .. import Frequency
from ..models import StockInfo, History
from ...decorators import require_login


@csrf_exempt
@require_GET
@require_login
def all_companies_single_day(request: HttpRequest):
    sid_list = request.GET.get("sid-list", [])
    sid_list = sid_list.split(",") if len(sid_list) > 0 else sid_list

    res = {"success": False, "data": []}
    try:
        # SELECT sid from trade_record GROUP BY sid HAVING SUM(deal_quantity) > 0
        # autoSidQuery = (
        #     trade_record.objects.values("company__pk")
        #     .annotate(sum=Sum("deal_quantity"))
        #     .filter(sum__gt=0)
        #     .values("company__pk")
        # )

        for si in StockInfo.objects.filter(company__pk__in=sid_list):
            res["data"].append(
                {
                    "sid": si.company.pk,
                    "name": si.company.name,
                    "quantity": si.quantity,
                    "close": si.close_price,
                    "fluct_price": si.fluct_price,
                }
            )
        res["success"] = True
    except Exception as e:
        res["error"] = str(e)
    return JsonResponse(res)


@csrf_exempt
@require_GET
@require_login
def single_company_multiple_days(request: HttpRequest, sid):
    sid = str(sid)
    res = {"success": False, "data": []}
    try:
        frequency = request.GET.get("frequency", Frequency.DAILY)
        count = int(request.GET.get("count", "60"))
        # History.objects.filter(company__pk=sid, frequency=frequency)
        res["success"] = True
    except Exception as e:
        res["error"] = str(e)
    return JsonResponse(res)
