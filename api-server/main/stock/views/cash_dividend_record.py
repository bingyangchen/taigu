import json
from datetime import datetime

from django.http import HttpRequest, JsonResponse

from main.core.decorators import require_login
from main.stock import UnknownStockIdError
from main.stock.models import CashDividendRecord, Company


@require_login
def create_or_list(request: HttpRequest) -> JsonResponse:
    if request.method == "POST":
        payload = json.loads(request.body)
        if (
            (not (deal_time := payload.get("deal_time")))
            or (not (sid := payload.get("sid")))
            or ((cash_dividend := payload.get("cash_dividend")) is None)
        ):
            return JsonResponse({"message": "Data Not Sufficient"}, status=400)
        else:
            deal_time = datetime.strptime(str(deal_time), "%Y-%m-%d").date()
            sid = str(sid)
            cash_dividend = int(cash_dividend)
            try:
                company = Company.objects.get(pk=sid)
                record = CashDividendRecord.objects.create(
                    owner=request.user,
                    company=company,
                    deal_time=deal_time,
                    cash_dividend=cash_dividend,
                )
                return JsonResponse(
                    {
                        "id": record.pk,
                        "deal_time": record.deal_time,
                        "sid": record.company.pk,
                        "company_name": record.company.name,
                        "cash_dividend": record.cash_dividend,
                    }
                )
            except UnknownStockIdError as e:
                return JsonResponse({"message": str(e)}, status=400)
    elif request.method == "GET":
        deal_times = json.loads(request.GET.get("deal_times", "[]"))
        sids = json.loads(request.GET.get("sids", "[]"))
        if deal_times or sids:
            if deal_times and sids:
                query_set = request.user.cash_dividend_records.filter(  # type: ignore
                    deal_time__in=deal_times
                ).filter(company__pk__in=sids)
            elif not deal_times:
                query_set = request.user.cash_dividend_records.filter(  # type: ignore
                    company__pk__in=sids
                )
            else:
                query_set = request.user.cash_dividend_records.filter(  # type: ignore
                    deal_time__in=deal_times
                )
        else:
            query_set = request.user.cash_dividend_records.all()  # type: ignore
        query_set = query_set.select_related("company").order_by("-deal_time")
        return JsonResponse(
            {
                "data": [
                    {
                        "id": record.pk,
                        "deal_time": record.deal_time,
                        "sid": record.company.pk,
                        "company_name": record.company.name,
                        "cash_dividend": record.cash_dividend,
                    }
                    for record in query_set
                ]
            }
        )
    else:
        return JsonResponse({"message": "Method Not Allowed"}, status=405)


@require_login
def update_or_delete(request: HttpRequest, id: str | int) -> JsonResponse:
    id = int(id)
    if request.method == "POST":
        payload = json.loads(request.body)
        if (
            (not (deal_time := payload.get("deal_time")))
            or (not (sid := payload.get("sid")))
            or ((cash_dividend := payload.get("cash_dividend")) is None)
        ):
            return JsonResponse({"message": "Data Not Sufficient"}, status=400)
        else:
            sid = str(sid)
            try:
                company = Company.objects.get(pk=sid)
                record = CashDividendRecord.objects.get(pk=id)
                record.company = company
                record.deal_time = datetime.strptime(str(deal_time), "%Y-%m-%d").date()
                record.cash_dividend = int(cash_dividend)
                record.save()
                return JsonResponse(
                    {
                        "id": record.pk,
                        "deal_time": record.deal_time,
                        "sid": record.company.pk,
                        "company_name": record.company.name,
                        "cash_dividend": record.cash_dividend,
                    }
                )
            except UnknownStockIdError as e:
                return JsonResponse({"message": str(e)}, status=400)
    elif request.method == "DELETE":
        CashDividendRecord.objects.get(pk=id).delete()
        return JsonResponse({})
    else:
        return JsonResponse({"message": "Method Not Allowed"}, status=405)
