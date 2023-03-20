import datetime

import pytz
from django.http import HttpRequest, JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_GET

from ...decorators import require_login
from .. import Frequency
from ..models import Company, History, StockInfo
from ..utils import fetch_and_store_historical_info


@csrf_exempt
@require_GET
@require_login
def multiple_companies_single_day(request: HttpRequest):
    sid_list = request.GET.get("sid-list", [])
    sid_list = sid_list.split(",") if len(sid_list) > 0 else sid_list

    res = {"success": False, "data": []}
    try:
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
        if company := Company.objects.filter(pk=sid).first():
            queryset = History.objects.filter(company__pk=sid, frequency=frequency)
            if (not queryset.first()) or (
                not (
                    (
                        queryset.latest("-updated_at").updated_at.date()
                        == datetime.datetime.now().date()
                    )
                    or (
                        queryset.latest("date").date
                        == (
                            datetime.datetime.now(pytz.utc)
                            + datetime.timedelta(hours=8)
                        ).date()
                    )
                )
            ):
                try:
                    fetch_and_store_historical_info(company, frequency)
                except:
                    ...
            for h in History.objects.filter(company=company, frequency=frequency):
                res["data"].append({"date": h.date, "price": h.close_price})
        res["success"] = True
    except Exception as e:
        res["error"] = str(e)
    return JsonResponse(res)
