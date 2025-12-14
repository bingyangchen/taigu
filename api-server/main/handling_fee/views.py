import json
import logging
from datetime import datetime

from django.http import HttpRequest, JsonResponse
from django.views.decorators.http import require_http_methods

from main.core.decorators import require_login
from main.handling_fee.models import HandlingFeeDiscountRecord

logger = logging.getLogger(__name__)


@require_http_methods(["POST", "GET"])
@require_login
def create_or_list_discount(request: HttpRequest) -> JsonResponse:
    if request.method == "POST":
        return create_discount(request)
    elif request.method == "GET":
        return list_discounts(request)
    else:
        return JsonResponse({"message": "Method Not Allowed"}, status=405)


@require_http_methods(["PUT", "DELETE"])
@require_login
def update_or_delete_discount(request: HttpRequest, id: str | int) -> JsonResponse:
    if request.method == "PUT":
        return update_discount(request, id)
    elif request.method == "DELETE":
        return delete_discount(request, id)
    else:
        return JsonResponse({"message": "Method Not Allowed"}, status=405)


def create_discount(request: HttpRequest) -> JsonResponse:
    payload = json.loads(request.body)

    if (date := payload.get("date")) is None or (
        amount := payload.get("amount")
    ) is None:
        return JsonResponse({"message": "Data Not Sufficient"}, status=400)

    if amount < 0:
        return JsonResponse({"message": "Amount must be positive"}, status=400)

    try:
        date = datetime.strptime(str(date), "%Y-%m-%d").date()
    except Exception:
        return JsonResponse({"message": "Invalid Date Format"}, status=400)

    discount = HandlingFeeDiscountRecord.objects.create(
        owner=request.user, date=date, amount=amount, memo=payload.get("memo", "")
    )
    return JsonResponse(
        {
            "id": discount.pk,
            "date": discount.date,
            "amount": discount.amount,
            "memo": discount.memo,
        }
    )


def list_discounts(request: HttpRequest) -> JsonResponse:
    discounts = (
        HandlingFeeDiscountRecord.objects.filter(owner=request.user)
        .values("id", "date", "amount", "memo")
        .order_by("-date")
    )
    return JsonResponse({"data": list(discounts)})


def update_discount(request: HttpRequest, id: str | int) -> JsonResponse:
    payload = json.loads(request.body)

    if (date := payload.get("date")) is not None:
        try:
            date = datetime.strptime(str(date), "%Y-%m-%d").date()
        except Exception:
            return JsonResponse({"message": "Invalid Date Format"}, status=400)

    discount = HandlingFeeDiscountRecord.objects.get(pk=int(id), owner=request.user)
    if date is not None:
        discount.date = date
    if (amount := payload.get("amount")) is not None:
        if amount < 0:
            return JsonResponse({"message": "Amount must be positive"}, status=400)
        discount.amount = amount
    if (memo := payload.get("memo")) is not None:
        discount.memo = memo
    discount.save()
    return JsonResponse(
        {
            "id": discount.pk,
            "date": discount.date,
            "amount": discount.amount,
            "memo": discount.memo,
        }
    )


def delete_discount(request: HttpRequest, id: str | int) -> JsonResponse:
    HandlingFeeDiscountRecord.objects.get(pk=int(id), owner=request.user).delete()
    return JsonResponse({})
