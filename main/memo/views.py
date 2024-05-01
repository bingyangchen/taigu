import json

from django.http import HttpRequest, JsonResponse
from django.views.decorators.http import require_GET, require_POST

from main.core.decorators import require_login
from main.stock import UnknownStockIdError
from main.stock.models import Company

from .models import Favorite, StockMemo, TradePlan


@require_POST
@require_login
def update_or_create_stock_memo(request: HttpRequest, sid: str):
    result = {"success": False, "data": None}

    payload = json.loads(request.body)
    business = payload.get("business")
    strategy = payload.get("strategy")
    note = payload.get("note")

    try:
        company, created = Company.objects.get_or_create(pk=sid)
        memo = StockMemo.objects.filter(owner=request.user, company=company).first()
        if memo:
            if business is not None:
                memo.business = business
            if strategy is not None:
                memo.strategy = strategy
            if note is not None:
                memo.note = note
            memo.save()
        else:
            memo = StockMemo.objects.create(
                owner=request.user,
                company=company,
                business=business or "",
                strategy=strategy or "",
                note=note or "",
            )
        result["data"] = {
            "id": memo.pk,
            "sid": memo.company.pk,
            "company_name": memo.company.name,
            "business": memo.business,
            "strategy": memo.strategy,
            "note": memo.note,
        }
        result["success"] = True
    except UnknownStockIdError as e:
        result["error"] = str(e)
    return JsonResponse(result)


@require_GET
@require_login
def list_stock_memo(request: HttpRequest):
    result = {"success": False, "data": None}
    sids = [sid for sid in request.GET.get("sids", "").strip(",").split(",") if sid]
    if sids:
        query_set = request.user.stock_memos.filter(company__pk__in=sids)
    else:
        query_set = request.user.stock_memos.all()
    query_set = query_set.select_related("company")
    result["data"] = [
        {
            "id": memo.pk,
            "sid": memo.company.pk,
            "company_name": memo.company.name,
            "business": memo.business,
            "strategy": memo.strategy,
            "note": memo.note,
        }
        for memo in query_set
    ]
    result["success"] = True
    return JsonResponse(result)


@require_login
def create_or_list_trade_plan(request: HttpRequest):
    result = {"success": False, "data": None}
    if request.method == "POST":
        payload = json.loads(request.body)
        if (
            (not (sid := payload.get("sid")))
            or (not (plan_type := payload.get("plan_type")))
            or ((target_price := payload.get("target_price")) is None)
            or ((target_quantity := payload.get("target_quantity")) is None)
        ):
            result["error"] = "Data Not Sufficient"
        else:
            sid = str(sid)
            target_quantity = int(target_quantity)
            try:
                company, created = Company.objects.get_or_create(pk=sid)
                plan = TradePlan.objects.create(
                    owner=request.user,
                    company=company,
                    plan_type=plan_type,
                    target_price=target_price,
                    target_quantity=target_quantity,
                )
                result["data"] = {
                    "id": plan.pk,
                    "sid": plan.company.pk,
                    "company_name": plan.company.name,
                    "plan_type": plan.plan_type,
                    "target_price": plan.target_price,
                    "target_quantity": plan.target_quantity,
                }
                result["success"] = True
            except UnknownStockIdError as e:
                result["error"] = str(e)
    elif request.method == "GET":
        sids = [sid for sid in request.GET.get("sids", "").strip(",").split(",") if sid]
        if sids:
            query_set = request.user.trade_plans.filter(company__pk__in=sids)
        else:
            query_set = request.user.trade_plans.all()
        query_set = query_set.select_related("company")
        result["data"] = [
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
        result["success"] = True
    else:
        result["error"] = "Method Not Allowed"
    return JsonResponse(result)


@require_login
def update_or_delete_trade_plan(request: HttpRequest, id):
    result = {"success": False, "data": None}
    id = int(id)

    if request.method == "POST":
        payload = json.loads(request.body)
        if (
            (not (sid := payload.get("sid")))
            or (not (plan_type := payload.get("plan_type")))
            or ((target_price := payload.get("target_price")) is None)
            or ((target_quantity := payload.get("target_quantity")) is None)
        ):
            result["error"] = "Data Not Sufficient"
        else:
            sid = str(sid)
            target_quantity = int(target_quantity)
            try:
                company, created = Company.objects.get_or_create(pk=sid)
                plan = TradePlan.objects.get(pk=id)
                plan.company = company
                plan.plan_type = plan_type
                plan.target_price = target_price
                plan.target_quantity = target_quantity
                plan.save()

                result["data"] = {
                    "id": plan.pk,
                    "sid": plan.company.pk,
                    "company_name": plan.company.name,
                    "plan_type": plan.plan_type,
                    "target_price": plan.target_price,
                    "target_quantity": plan.target_quantity,
                }
                result["success"] = True
            except UnknownStockIdError as e:
                result["error"] = str(e)
    elif request.method == "DELETE":
        TradePlan.objects.get(pk=id).delete()
        result["success"] = True
    else:
        result["error"] = "Method Not Allowed"
    return JsonResponse(result)


@require_login
def create_or_delete_favorite(request: HttpRequest, sid: str):
    result = {"success": False, "data": None}
    try:
        company, created = Company.objects.get_or_create(pk=sid)
        if request.method == "POST":
            Favorite.objects.get_or_create(owner=request.user, company=company)
            result = {"success": True, "data": sid}
        elif request.method == "DELETE":
            if favorite := Favorite.objects.filter(
                owner=request.user, company=company
            ).first():
                favorite.delete()
            result = {"success": True, "data": sid}
        else:
            result["error"] = "Method Not Allowed"
    except Exception as e:
        result["error"] = str(e)
    return JsonResponse(result)


@require_GET
@require_login
def list_favorites(request: HttpRequest):
    result = {"success": False, "data": None}
    try:
        query_set = Favorite.objects.filter(owner=request.user).select_related(
            "company"
        )
        result["data"] = [favorite.company.pk for favorite in query_set]
        result["success"] = True
    except Exception as e:
        result["error"] = str(e)
    return JsonResponse(result)
