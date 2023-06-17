import json

from django.http import HttpRequest, JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_GET, require_POST

from investment.stock.models import Company
from investment.stock.utils import UnknownStockIdError, fetch_company_info

from ..decorators import require_login
from .models import StockMemo, TradePlan


@csrf_exempt
@require_POST
@require_login
def update_or_create_stock_memo(request: HttpRequest, sid):
    res = {"success": False, "data": None}

    payload = json.loads(request.body)
    sid = str(sid)
    business = payload.get("business")
    strategy = payload.get("strategy")
    note = payload.get("note")

    try:
        company_info = fetch_company_info(sid)
        c, created = Company.objects.get_or_create(
            pk=sid,
            defaults={
                "name": company_info["name"],
                "trade_type": company_info["trade_type"],
            },
        )
        m = StockMemo.objects.filter(owner=request.user, company=c).first()
        if m:
            if business != None:
                m.business = business
            if strategy != None:
                m.strategy = strategy
            if note != None:
                m.note = note
            m.save()
        else:
            m = StockMemo.objects.create(
                owner=request.user,
                company=c,
                business=business or "",
                strategy=strategy or "",
                note=note or "",
            )
        res["data"] = {
            "id": m.pk,
            "sid": m.company.pk,
            "company_name": m.company.name,
            "business": m.business,
            "strategy": m.strategy,
            "note": m.note,
        }
        res["success"] = True
    except UnknownStockIdError as e:
        res["error"] = str(e)
    return JsonResponse(res)


@csrf_exempt
@require_GET
@require_login
def list_stock_memo(request: HttpRequest):
    sid_list = request.GET.get("sid-list", [])
    res = {"success": False, "data": None}

    if sid_list != []:
        sid_list = sid_list.strip(",").split(",")
        queryset = request.user.stock_memos.filter(company__pk__in=sid_list)
    else:
        queryset = request.user.stock_memos.all()

    result = []
    for each in queryset:
        result.append(
            {
                "id": each.pk,
                "sid": each.company.pk,
                "company_name": each.company.name,
                "business": each.business,
                "strategy": each.strategy,
                "note": each.note,
            }
        )
    res["data"] = result
    res["success"] = True
    return JsonResponse(res)


@csrf_exempt
@require_login
def create_or_list_trade_plan(request: HttpRequest):
    res = {"success": False, "data": None}
    if request.method == "POST":
        payload = json.loads(request.body)
        if (
            (not (sid := payload.get("sid")))
            or (not (plan_type := payload.get("plan_type")))
            or ((target_price := payload.get("target_price")) == None)
            or ((target_quantity := payload.get("target_quantity")) == None)
        ):
            res["error"] = "Data Not Sufficient"
        else:
            sid = str(sid)
            target_quantity = int(target_quantity)
            try:
                company_info = fetch_company_info(sid)
                c, created = Company.objects.get_or_create(
                    pk=sid,
                    defaults={
                        "name": company_info["name"],
                        "trade_type": company_info["trade_type"],
                    },
                )
                p: TradePlan = TradePlan.objects.create(
                    owner=request.user,
                    company=c,
                    plan_type=plan_type,
                    target_price=target_price,
                    target_quantity=target_quantity,
                )
                res["data"] = {
                    "id": p.pk,
                    "sid": p.company.pk,
                    "company_name": p.company.name,
                    "plan_type": p.plan_type,
                    "target_price": p.target_price,
                    "target_quantity": p.target_quantity,
                }
                res["success"] = True
            except UnknownStockIdError as e:
                res["error"] = str(e)
    elif request.method == "GET":
        sid_list = request.GET.get("sid-list", [])

        if sid_list != []:
            sid_list = sid_list.strip(",").split(",")
            queryset = request.user.trade_plans.filter(company__pk__in=sid_list)
        else:
            queryset = request.user.trade_plans.all()

        result = []
        for each in queryset:
            result.append(
                {
                    "id": each.pk,
                    "sid": each.company.pk,
                    "company_name": each.company.name,
                    "plan_type": each.plan_type,
                    "target_price": each.target_price,
                    "target_quantity": each.target_quantity,
                }
            )
        res["data"] = result
        res["success"] = True
    else:
        res["error"] = "Method Not Allowed"
    return JsonResponse(res)


@csrf_exempt
@require_login
def update_or_delete_trade_plan(request: HttpRequest, id):
    res = {"success": False, "data": None}
    id = int(id)

    if request.method == "POST":
        payload = json.loads(request.body)
        if (
            (not (sid := payload.get("sid")))
            or (not (plan_type := payload.get("plan_type")))
            or ((target_price := payload.get("target_price")) == None)
            or ((target_quantity := payload.get("target_quantity")) == None)
        ):
            res["error"] = "Data Not Sufficient"
        else:
            sid = str(sid)
            target_quantity = int(target_quantity)
            try:
                company_info = fetch_company_info(sid)
                c, created = Company.objects.get_or_create(
                    pk=sid,
                    defaults={
                        "name": company_info["name"],
                        "trade_type": company_info["trade_type"],
                    },
                )
                p: TradePlan = TradePlan.objects.get(pk=id)
                p.company = c
                p.plan_type = plan_type
                p.target_price = target_price
                p.target_quantity = target_quantity
                p.save()

                res["data"] = {
                    "id": p.pk,
                    "sid": p.company.pk,
                    "company_name": p.company.name,
                    "plan_type": p.plan_type,
                    "target_price": p.target_price,
                    "target_quantity": p.target_quantity,
                }
                res["success"] = True
            except UnknownStockIdError as e:
                res["error"] = str(e)
    elif request.method == "DELETE":
        TradePlan.objects.get(pk=id).delete()
        res["success"] = True
    else:
        res["error"] = "Method Not Allowed"
    return JsonResponse(res)
