import json
from datetime import datetime

from django.http import HttpRequest, JsonResponse
from django.views.decorators.http import require_GET, require_POST

from main.core.decorators import require_login
from main.stock import UnknownStockIdError
from main.stock.models import CashDividendRecord, Company


@require_GET
@require_login
def list(request: HttpRequest) -> JsonResponse:
    deal_times = json.loads(request.GET.get("deal_times", "[]"))  # type: ignore
    sids = json.loads(request.GET.get("sids", "[]"))  # type: ignore
    if deal_times or sids:
        if deal_times and sids:
            query_set = request.user.cash_dividend_records.filter(
                deal_time__in=deal_times
            ).filter(company__pk__in=sids)
        elif not deal_times:
            query_set = request.user.cash_dividend_records.filter(company__pk__in=sids)
        else:
            query_set = request.user.cash_dividend_records.filter(
                deal_time__in=deal_times
            )
    else:
        query_set = request.user.cash_dividend_records.all()

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


@require_POST
@require_login
def create(request: HttpRequest) -> JsonResponse:
    payload = json.loads(request.body)

    if (
        (not (deal_time := payload.get("deal_time")))
        or (not (sid := payload.get("sid")))
        or ((cash_dividend := payload.get("cash_dividend")) is None)
    ):
        return JsonResponse({"message": "Data Not Sufficient"}, status=400)

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


@require_login
def update_or_delete(request: HttpRequest, id: str | int) -> JsonResponse:
    if request.method == "POST":
        return update(request, id)
    elif request.method == "DELETE":
        return delete(request, id)
    else:
        return JsonResponse({"message": "Method Not Allowed"}, status=405)


def update(request: HttpRequest, id: str | int) -> JsonResponse:
    id = int(id)
    payload = json.loads(request.body)
    if (
        (not (deal_time := payload.get("deal_time")))
        or (not (sid := payload.get("sid")))
        or ((cash_dividend := payload.get("cash_dividend")) is None)
    ):
        return JsonResponse({"message": "Data Not Sufficient"}, status=400)

    sid = str(sid)
    try:
        company = Company.objects.get(pk=sid)
        record = CashDividendRecord.objects.get(pk=id, owner=request.user)
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


def delete(request: HttpRequest, id: str | int) -> JsonResponse:
    CashDividendRecord.objects.get(pk=int(id), owner=request.user).delete()
    return JsonResponse({})
