import json
from datetime import datetime

from django.core.exceptions import ObjectDoesNotExist
from django.http import HttpRequest, JsonResponse
from django.views.decorators.http import require_http_methods

from main.cash_dividend.models import CashDividendRecord
from main.core.decorators.auth import require_login
from main.core.decorators.rate_limit import rate_limit
from main.market.models import Company


@rate_limit(rate=2)
@require_login
@require_http_methods(["GET", "POST"])
def create_or_list(request: HttpRequest) -> JsonResponse:
    if request.method == "GET":
        return _list(request)
    elif request.method == "POST":
        return _create(request)
    else:
        return JsonResponse({"message": "Method Not Allowed"}, status=405)


def _list(request: HttpRequest) -> JsonResponse:
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


def _create(request: HttpRequest) -> JsonResponse:
    payload = json.loads(request.body)

    if (
        (not (deal_time := payload.get("deal_time")))
        or (not (sid := payload.get("sid")))
        or ((cash_dividend := payload.get("cash_dividend")) is None)
    ):
        return JsonResponse({"message": "Data Not Sufficient"}, status=400)

    deal_time = datetime.strptime(str(deal_time), "%Y-%m-%d").date()
    cash_dividend = int(cash_dividend)
    if cash_dividend < 0:
        return JsonResponse({"message": "Cash dividend must be positive"}, status=400)

    try:
        company = Company.objects.get(pk=str(sid))
    except ObjectDoesNotExist:
        return JsonResponse({"message": "Unknown Stock ID"}, status=400)

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


@rate_limit(rate=1)
@require_login
@require_http_methods(["POST", "DELETE"])
def update_or_delete(request: HttpRequest, id: str | int) -> JsonResponse:
    if request.method == "POST":
        return _update(request, id)
    elif request.method == "DELETE":
        return _delete(request, id)
    else:
        return JsonResponse({"message": "Method Not Allowed"}, status=405)


def _update(request: HttpRequest, id: str | int) -> JsonResponse:
    payload = json.loads(request.body)
    if (
        (not (deal_time := payload.get("deal_time")))
        or (not (sid := payload.get("sid")))
        or ((cash_dividend := payload.get("cash_dividend")) is None)
    ):
        return JsonResponse({"message": "Data Not Sufficient"}, status=400)

    cash_dividend = int(cash_dividend)
    if cash_dividend < 0:
        return JsonResponse({"message": "Cash dividend must be positive"}, status=400)

    try:
        company = Company.objects.get(pk=str(sid))
    except ObjectDoesNotExist:
        return JsonResponse({"message": "Unknown Stock ID"}, status=400)

    record = CashDividendRecord.objects.get(pk=int(id), owner=request.user)
    record.company = company
    record.deal_time = datetime.strptime(str(deal_time), "%Y-%m-%d").date()
    record.cash_dividend = cash_dividend
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


def _delete(request: HttpRequest, id: str | int) -> JsonResponse:
    CashDividendRecord.objects.get(pk=int(id), owner=request.user).delete()
    return JsonResponse({})
