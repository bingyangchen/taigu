import json
from datetime import datetime

from django.http import HttpRequest, JsonResponse

from main.core.decorators import require_login

from .. import UnknownStockIdError
from ..models import CashDividendRecord, Company


@require_login
def create_or_list(request: HttpRequest):
    result = {"success": False, "data": None}
    if request.method == "POST":
        payload = json.loads(request.body)
        if (
            (not (deal_time := payload.get("deal_time")))
            or (not (sid := payload.get("sid")))
            or ((cash_dividend := payload.get("cash_dividend")) is None)
        ):
            result["error"] = "Data Not Sufficient"
        else:
            deal_time = datetime.strptime(str(deal_time), "%Y-%m-%d").date()
            sid = str(sid)
            cash_dividend = int(cash_dividend)
            try:
                company, created = Company.objects.get_or_create(pk=sid)
                record = CashDividendRecord.objects.create(
                    owner=request.user,
                    company=company,
                    deal_time=deal_time,
                    cash_dividend=cash_dividend,
                )
                result["data"] = {
                    "id": record.pk,
                    "deal_time": record.deal_time,
                    "sid": record.company.pk,
                    "company_name": record.company.name,
                    "cash_dividend": record.cash_dividend,
                }
                result["success"] = True
            except UnknownStockIdError as e:
                result["error"] = str(e)
    elif request.method == "GET":
        deal_times = json.loads(request.GET.get("deal_times", "[]"))
        sids = json.loads(request.GET.get("sids", "[]"))

        if deal_times or sids:
            if deal_times and sids:
                query_set = request.user.cash_dividend_records.filter(
                    deal_time__in=deal_times
                ).filter(company__pk__in=sids)
            elif not deal_times:
                query_set = request.user.cash_dividend_records.filter(
                    company__pk__in=sids
                )
            else:
                query_set = request.user.cash_dividend_records.filter(
                    deal_time__in=deal_times
                )
        else:
            query_set = request.user.cash_dividend_records.all()

        query_set = query_set.order_by("-deal_time")

        result["data"] = [
            {
                "id": record.pk,
                "deal_time": record.deal_time,
                "sid": record.company.pk,
                "company_name": record.company.name,
                "cash_dividend": record.cash_dividend,
            }
            for record in query_set
        ]
        result["success"] = True
    else:
        result["error"] = "Method Not Allowed"
    return JsonResponse(result)


@require_login
def update_or_delete(request: HttpRequest, id):
    result = {"success": False, "data": None}
    id = int(id)

    if request.method == "POST":
        payload = json.loads(request.body)
        if (
            (not (deal_time := payload.get("deal_time")))
            or (not (sid := payload.get("sid")))
            or ((cash_dividend := payload.get("cash_dividend")) is None)
        ):
            result["error"] = "Data Not Sufficient"
        else:
            sid = str(sid)
            try:
                company, created = Company.objects.get_or_create(pk=sid)
                record = CashDividendRecord.objects.get(pk=id)
                record.company = company
                record.deal_time = datetime.strptime(str(deal_time), "%Y-%m-%d").date()
                record.cash_dividend = int(cash_dividend)
                record.save()
                result["data"] = {
                    "id": record.pk,
                    "deal_time": record.deal_time,
                    "sid": record.company.pk,
                    "company_name": record.company.name,
                    "cash_dividend": record.cash_dividend,
                }
                result["success"] = True
            except UnknownStockIdError as e:
                result["error"] = str(e)
    elif request.method == "DELETE":
        CashDividendRecord.objects.get(pk=id).delete()
        result["success"] = True
    else:
        result["error"] = "Method Not Allowed"
    return JsonResponse(result)
