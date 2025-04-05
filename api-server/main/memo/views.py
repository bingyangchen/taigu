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
    try:
        note = json.loads(request.body)["note"] or ""
        company, created = Company.objects.get_or_create(pk=sid)
        memo, created = StockMemo.objects.update_or_create(
            owner=request.user, company=company, defaults={"note": note}
        )
        return JsonResponse(
            {
                "sid": memo.company.pk,
                "company_name": memo.company.name,
                "business": company.business,
                "note": memo.note,
            }
        )
    except UnknownStockIdError as e:
        return JsonResponse({"message": str(e)}, status=400)


@require_GET
@require_login
def list_company_info(request: HttpRequest):
    sids = [sid for sid in request.GET.get("sids", "").strip(",").split(",") if sid]
    if not sids:
        return JsonResponse({"message": "sids is required."}, status=400)
    company_query_set = Company.objects.prefetch_related("material_facts").filter(
        pk__in=sids
    )
    memo_query_set = request.user.stock_memos.filter(company__pk__in=sids)  # type: ignore
    stock_id_memo_map = {
        memo.company.pk: memo.note for memo in memo_query_set.select_related("company")
    }
    result = {}
    for company in company_query_set:
        result[company.pk] = {
            "sid": company.pk,
            "company_name": company.name,
            "business": company.business,
            "note": stock_id_memo_map.get(company.pk, ""),
            "material_facts": sorted(
                [
                    {
                        "date_time": m.date_time,
                        "title": m.title,
                        "description": m.description,
                    }
                    for m in company.material_facts.all()  # type: ignore
                ],
                key=lambda x: x["date_time"],
                reverse=True,
            ),
        }
    return JsonResponse(result)


@require_login
def create_or_list_trade_plan(request: HttpRequest):
    if request.method == "POST":
        payload = json.loads(request.body)
        if (
            (not (sid := payload.get("sid")))
            or (not (plan_type := payload.get("plan_type")))
            or ((target_price := payload.get("target_price")) is None)
            or ((target_quantity := payload.get("target_quantity")) is None)
        ):
            return JsonResponse({"message": "Data Not Sufficient"}, status=400)
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
            except UnknownStockIdError as e:
                return JsonResponse({"message": str(e)}, status=400)
    elif request.method == "GET":
        if sids := [
            sid for sid in request.GET.get("sids", "").strip(",").split(",") if sid
        ]:
            query_set = request.user.trade_plans.filter(company__pk__in=sids)  # type: ignore
        else:
            query_set = request.user.trade_plans.all()  # type: ignore
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
    else:
        return JsonResponse({"message": "Method Not Allowed"}, status=405)


@require_login
def update_or_delete_trade_plan(request: HttpRequest, id):
    id = int(id)
    if request.method == "POST":
        payload = json.loads(request.body)
        if (
            (not (sid := payload.get("sid")))
            or (not (plan_type := payload.get("plan_type")))
            or ((target_price := payload.get("target_price")) is None)
            or ((target_quantity := payload.get("target_quantity")) is None)
        ):
            return JsonResponse({"message": "Data Not Sufficient"}, status=400)
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
            except UnknownStockIdError as e:
                return JsonResponse({"message": str(e)}, status=400)
    elif request.method == "DELETE":
        TradePlan.objects.get(pk=id).delete()
        return JsonResponse({})
    else:
        return JsonResponse({"message": "Method Not Allowed"}, status=405)


@require_login
def create_or_delete_favorite(request: HttpRequest, sid: str):
    try:
        result = {"sid": None}
        company, created = Company.objects.get_or_create(pk=sid)
        if request.method == "POST":
            Favorite.objects.get_or_create(owner=request.user, company=company)
            result["sid"] = sid
        elif request.method == "DELETE":
            if favorite := Favorite.objects.filter(
                owner=request.user, company=company
            ).first():
                favorite.delete()
            result["sid"] = sid
        else:
            return JsonResponse({"message": "Method Not Allowed"}, status=405)
        return JsonResponse(result)
    except Exception as e:
        return JsonResponse({"message": str(e)}, status=400)


@require_GET
@require_login
def list_favorites(request: HttpRequest):
    try:
        query_set = Favorite.objects.filter(owner=request.user).select_related(
            "company"
        )
        return JsonResponse({"data": [favorite.company.pk for favorite in query_set]})
    except Exception as e:
        return JsonResponse({"message": str(e)}, status=400)
