import json
from datetime import datetime

from django.core.exceptions import ObjectDoesNotExist
from django.http import HttpRequest, JsonResponse
from django.views.decorators.http import require_GET, require_POST

from main.core.decorators import require_login
from main.stock.models import Company, TradeRecord


@require_GET
@require_login
def list(request: HttpRequest) -> JsonResponse:
    deal_times = [
        datetime.strptime(d, "%Y-%m-%d").date()
        for d in json.loads(request.GET.get("deal_times", "[]"))  # type: ignore
    ]
    sids = json.loads(request.GET.get("sids", "[]"))  # type: ignore
    if deal_times or sids:
        if deal_times and sids:
            query_set = request.user.trade_records.filter(
                deal_time__in=deal_times
            ).filter(company__pk__in=sids)
        elif not deal_times:
            query_set = request.user.trade_records.filter(company__pk__in=sids)
        else:
            query_set = request.user.trade_records.filter(deal_time__in=deal_times)
    else:
        query_set = request.user.trade_records.all()

    query_set = query_set.select_related("company").order_by(
        "-deal_time", "-created_at"
    )
    return JsonResponse(
        {
            "data": [
                {
                    "id": record.pk,
                    "deal_time": record.deal_time,
                    "sid": record.company.pk,
                    "company_name": record.company.name,
                    "deal_price": record.deal_price,
                    "deal_quantity": record.deal_quantity,
                    "handling_fee": record.handling_fee,
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
        or ((deal_price := payload.get("deal_price")) is None)
        or ((deal_quantity := payload.get("deal_quantity")) is None)
        or ((handling_fee := payload.get("handling_fee")) is None)
    ):
        return JsonResponse({"message": "Data Not Sufficient"}, status=400)

    try:
        company = Company.objects.get(pk=str(sid))
    except ObjectDoesNotExist:
        return JsonResponse({"message": "Unknown Stock ID"}, status=400)

    record = TradeRecord.objects.create(
        owner=request.user,
        company=company,
        deal_time=datetime.strptime(str(deal_time), "%Y-%m-%d").date(),
        deal_price=float(deal_price),
        deal_quantity=int(deal_quantity),
        handling_fee=int(handling_fee),
    )
    return JsonResponse(
        {
            "id": record.pk,
            "deal_time": record.deal_time,
            "sid": record.company.pk,
            "company_name": record.company.name,
            "deal_price": record.deal_price,
            "deal_quantity": record.deal_quantity,
            "handling_fee": record.handling_fee,
        }
    )


@require_login
def update_or_delete(request: HttpRequest, id: str | int) -> JsonResponse:
    if request.method == "POST":
        return update(request, id)
    elif request.method == "DELETE":
        return delete(request, id)
    else:
        return JsonResponse({"message": "Method Not Allowed"}, status=405)


def update(request: HttpRequest, id: str | int) -> JsonResponse:
    payload = json.loads(request.body)

    if (
        (not (deal_time := payload.get("deal_time")))
        or (not (sid := payload.get("sid")))
        or ((deal_price := payload.get("deal_price")) is None)
        or ((deal_quantity := payload.get("deal_quantity")) is None)
        or ((handling_fee := payload.get("handling_fee")) is None)
    ):
        return JsonResponse({"message": "Data Not Sufficient"}, status=400)

    try:
        company = Company.objects.get(pk=str(sid))
    except ObjectDoesNotExist:
        return JsonResponse({"message": "Unknown Stock ID"}, status=400)

    record = TradeRecord.objects.get(pk=int(id), owner=request.user)
    record.company = company
    record.deal_time = datetime.strptime(str(deal_time), "%Y-%m-%d").date()
    record.deal_price = float(deal_price)
    record.deal_quantity = int(deal_quantity)
    record.handling_fee = int(handling_fee)
    record.save()
    return JsonResponse(
        {
            "id": record.pk,
            "deal_time": record.deal_time,
            "sid": record.company.pk,
            "company_name": record.company.name,
            "deal_price": record.deal_price,
            "deal_quantity": record.deal_quantity,
            "handling_fee": record.handling_fee,
        }
    )


def delete(request: HttpRequest, id: str | int) -> JsonResponse:
    TradeRecord.objects.get(pk=int(id), owner=request.user).delete()
    return JsonResponse({})
