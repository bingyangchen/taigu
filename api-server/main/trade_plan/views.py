import json

from django.core.exceptions import ObjectDoesNotExist
from django.http import HttpRequest, JsonResponse
from django.views.decorators.http import require_GET, require_http_methods, require_POST

from main.core.decorators.auth import require_login
from main.core.decorators.rate_limit import rate_limit
from main.market.models import Company
from main.trade_plan.models import TradePlan


@require_http_methods(["GET", "POST"])
def create_or_list_trade_plans(request: HttpRequest) -> JsonResponse:
    if request.method == "GET":
        return list_trade_plans(request)
    elif request.method == "POST":
        return create_trade_plan(request)
    else:
        return JsonResponse({"message": "Method Not Allowed"}, status=405)


@rate_limit(rate=1)
@require_POST
@require_login
def create_trade_plan(request: HttpRequest) -> JsonResponse:
    payload = json.loads(request.body)

    if (
        (not (sid := payload.get("sid")))
        or (not (plan_type := payload.get("plan_type")))
        or ((target_price := payload.get("target_price")) is None)
        or ((target_quantity := payload.get("target_quantity")) is None)
    ):
        return JsonResponse({"message": "Data Not Sufficient"}, status=400)

    target_quantity = int(target_quantity)
    if target_quantity < 0:
        return JsonResponse({"message": "Target quantity must be positive"}, status=400)

    try:
        company = Company.objects.get(pk=str(sid))
    except ObjectDoesNotExist:
        return JsonResponse({"message": "Unknown Stock ID"}, status=400)

    plan = TradePlan.objects.create(
        owner=request.user,
        company=company,
        plan_type=plan_type,
        target_price=target_price,
        target_quantity=target_quantity,
    )
    return JsonResponse(
        {
            "id": plan.pk,
            "sid": plan.company.pk,
            "company_name": plan.company.name,
            "plan_type": plan.plan_type,
            "target_price": plan.target_price,
            "target_quantity": plan.target_quantity,
        }
    )


@rate_limit(rate=2)
@require_GET
@require_login
def list_trade_plans(request: HttpRequest) -> JsonResponse:
    if sids := [
        sid for sid in request.GET.get("sids", "").strip(",").split(",") if sid
    ]:
        query_set = request.user.trade_plans.filter(company__pk__in=sids)
    else:
        query_set = request.user.trade_plans.all()

    query_set = query_set.select_related("company")
    return JsonResponse(
        {
            "data": [
                {
                    "id": plan.pk,
                    "sid": plan.company.pk,
                    "company_name": plan.company.name,
                    "plan_type": plan.plan_type,
                    "target_price": plan.target_price,
                    "target_quantity": plan.target_quantity,
                }
                for plan in query_set
            ]
        }
    )


@rate_limit(rate=1)
@require_login
@require_http_methods(["POST", "DELETE"])
def update_or_delete_trade_plan(request: HttpRequest, id: str | int) -> JsonResponse:
    if request.method == "POST":
        return _update_trade_plan(request, id)
    elif request.method == "DELETE":
        return _delete_trade_plan(request, id)
    else:
        return JsonResponse({"message": "Method Not Allowed"}, status=405)


def _update_trade_plan(request: HttpRequest, id: str | int) -> JsonResponse:
    payload = json.loads(request.body)

    if (
        (not (sid := payload.get("sid")))
        or (not (plan_type := payload.get("plan_type")))
        or ((target_price := payload.get("target_price")) is None)
        or ((target_quantity := payload.get("target_quantity")) is None)
    ):
        return JsonResponse({"message": "Data Not Sufficient"}, status=400)

    target_quantity = int(target_quantity)
    if target_quantity < 0:
        return JsonResponse({"message": "Target quantity must be positive"}, status=400)

    try:
        company = Company.objects.get(pk=str(sid))
    except ObjectDoesNotExist:
        return JsonResponse({"message": "Unknown Stock ID"}, status=400)

    plan = TradePlan.objects.get(pk=int(id), owner=request.user)
    plan.company = company
    plan.plan_type = plan_type
    plan.target_price = target_price
    plan.target_quantity = target_quantity
    plan.save()
    return JsonResponse(
        {
            "id": plan.pk,
            "sid": plan.company.pk,
            "company_name": plan.company.name,
            "plan_type": plan.plan_type,
            "target_price": plan.target_price,
            "target_quantity": plan.target_quantity,
        }
    )


def _delete_trade_plan(request: HttpRequest, id: str | int) -> JsonResponse:
    TradePlan.objects.get(pk=int(id), owner=request.user).delete()
    return JsonResponse({})
