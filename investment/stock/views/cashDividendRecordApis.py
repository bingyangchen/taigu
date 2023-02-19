from datetime import datetime
import json

from django.http import JsonResponse, HttpRequest
from django.views.decorators.csrf import csrf_exempt

from ..utils import getCompanyName, validateStockId, UnknownStockIdError
from ..models import CashDividendRecord, Company
from ...decorators import require_login


@csrf_exempt
@require_login
def create_or_list_cash_dividend_record(request: HttpRequest):
    res = {"success": False, "data": None}
    if request.method == "POST":
        payload = json.loads(request.body)

        deal_time = payload.get("deal_time")
        sid = payload.get("sid")
        cash_dividend = payload.get("cash_dividend")

        if (not deal_time) or (not sid) or (cash_dividend == None):
            res["error"] = "Data not sufficient."
        else:
            deal_time = datetime.strptime(str(deal_time), "%Y-%m-%d").date()
            sid = str(sid)
            cash_dividend = int(cash_dividend)
            try:
                validateStockId(sid)
                c, created = Company.objects.get_or_create(
                    pk=sid, defaults={"name": getCompanyName(sid)}
                )
                cdr = CashDividendRecord.objects.create(
                    owner=request.user,
                    company=c,
                    deal_time=deal_time,
                    cash_dividend=cash_dividend,
                )
                res["data"] = {
                    "id": cdr.pk,
                    "deal_time": cdr.deal_time,
                    "sid": cdr.company.pk,
                    "company_name": cdr.company.name,
                    "cash_dividend": cdr.cash_dividend,
                }
                res["success"] = True
            except UnknownStockIdError as e:
                res["error"] = str(e)
    elif request.method == "GET":
        deal_time_list = json.loads(request.GET.get("deal_time_list", "[]"))
        sid_list = json.loads(request.GET.get("sid_list", "[]"))

        if (deal_time_list != []) or (sid_list != []):
            if (deal_time_list != []) and (sid_list != []):
                queryset = request.user.cash_dividend_records.filter(
                    deal_time__in=deal_time_list
                ).filter(company__pk__in=sid_list)
            elif deal_time_list == []:
                queryset = request.user.cash_dividend_records.filter(
                    company__pk__in=sid_list
                )
            else:
                queryset = request.user.cash_dividend_records.filter(
                    deal_time__in=deal_time_list
                )
        else:
            queryset = request.user.cash_dividend_records.all()

        queryset = queryset.order_by("-deal_time")

        result = []
        for cdr in queryset:
            result.append(
                {
                    "id": cdr.pk,
                    "deal_time": cdr.deal_time,
                    "sid": cdr.company.pk,
                    "company_name": cdr.company.name,
                    "cash_dividend": cdr.cash_dividend,
                }
            )
        res["data"] = result
        res["success"] = True
    else:
        res["error"] = "Method Not Allowed"
    return JsonResponse(res)


@csrf_exempt
@require_login
def update_or_delete_cash_dividend_record(request: HttpRequest, id):
    res = {"success": False, "data": None}
    id = int(id)

    if request.method == "POST":
        payload = json.loads(request.body)

        deal_time = payload.get("deal_time")
        sid = payload.get("sid")
        cash_dividend = payload.get("cash_dividend")

        if (not deal_time) or (not sid) or (cash_dividend == None):
            res["error"] = "Data not sufficient."
        else:
            sid = str(sid)
            try:
                validateStockId(sid)
                c, created = Company.objects.get_or_create(
                    pk=sid, defaults={"name": getCompanyName(sid)}
                )
                cdr = CashDividendRecord.objects.get(pk=id)
                cdr.company = c
                cdr.deal_time = datetime.strptime(str(deal_time), "%Y-%m-%d").date()
                cdr.cash_dividend = int(cash_dividend)
                cdr.save()
                res["data"] = {
                    "id": cdr.pk,
                    "deal_time": cdr.deal_time,
                    "sid": cdr.company.pk,
                    "company_name": cdr.company.name,
                    "cash_dividend": cdr.cash_dividend,
                }
                res["success"] = True
            except UnknownStockIdError as e:
                res["error"] = str(e)
    elif request.method == "DELETE":
        CashDividendRecord.objects.get(pk=id).delete()
        res["success"] = True
    else:
        res["error"] = "Method Not Allowed"
    return JsonResponse(res)
