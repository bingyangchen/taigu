import json

from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST
from django.http import JsonResponse, HttpRequest

from ..decorators import require_login
from investment.stock.models import company as Company
from .models import stock_memo as StockMemo, trade_plan as TradePlan
from investment.stock.utils import getCompanyName


@csrf_exempt
@require_POST
@require_login
def update_or_create_stock_memo(request: HttpRequest):
    sid = request.POST.get("sid")
    business = request.POST.get("business")
    strategy = request.POST.get("strategy")
    note = request.POST.get("note")

    res = {"success": False, "data": None}

    if sid == None:
        res["error"] = "Data not sufficient."
    else:
        c, created = Company.objects.get_or_create(
            pk=sid, defaults={"name": getCompanyName(sid)}
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
            m: StockMemo = StockMemo.objects.create(
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

    return JsonResponse(res)


@csrf_exempt
@require_POST
@require_login
def read_stock_memo(request: HttpRequest):
    sidList = json.loads(request.POST.get("sid-list", "[]"))

    res = {"success": False, "data": []}

    if sidList != []:
        query = request.user.stock_memos.filter(company__pk__in=sidList)
    else:
        query = request.user.stock_memos.all()

    for each in query:
        res["data"].append(
            {
                "id": each.pk,
                "sid": each.company.pk,
                "company_name": each.company.name,
                "business": each.business,
                "strategy": each.strategy,
                "note": each.note,
            }
        )
    res["success"] = True

    return JsonResponse(res)


@csrf_exempt
@require_POST
@require_login
def delete_stock_memo(request: HttpRequest):
    stock_memo_id = request.POST.get("id")

    res = {"success": False}

    if stock_memo_id == None:
        res["error"] = "Data not sufficient."
    else:
        StockMemo.objects.get(pk=stock_memo_id).delete()
        res["success"] = True

    return JsonResponse(res)


@csrf_exempt
@require_POST
@require_login
def create_trade_plan(request: HttpRequest):
    sid = request.POST.get("sid")
    planType = request.POST.get("plan_type")
    targetPrice = request.POST.get("target_price")
    targetQuantity = request.POST.get("target_quantity")

    res = {"success": False, "data": None}

    if sid == None or planType == None or targetPrice == None or targetQuantity == None:
        res["error"] = "Data not sufficient."
    else:
        c, created = Company.objects.get_or_create(
            pk=sid, defaults={"name": getCompanyName(sid)}
        )
        p: TradePlan = TradePlan.objects.create(
            owner=request.user,
            company=c,
            plan_type=planType,
            target_price=targetPrice,
            target_quantity=targetQuantity,
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

    return JsonResponse(res)


@csrf_exempt
@require_POST
@require_login
def read_trade_plan(request: HttpRequest):
    sidList = json.loads(request.POST.get("sid-list", "[]"))

    res = {"success": False, "data": []}

    if sidList != []:
        query = request.user.trade_plans.filter(company__pk__in=sidList)
    else:
        query = request.user.trade_plans.all()

    for each in query:
        res["data"].append(
            {
                "id": each.pk,
                "sid": each.company.pk,
                "company_name": each.company.name,
                "plan_type": each.plan_type,
                "target_price": each.target_price,
                "target_quantity": each.target_quantity,
            }
        )
    res["success"] = True

    return JsonResponse(res)


@csrf_exempt
@require_POST
@require_login
def update_trade_plan(request: HttpRequest):
    trade_plan_id = request.POST.get("id")
    sid = request.POST.get("sid")
    planType = request.POST.get("plan_type")
    targetPrice = request.POST.get("target_price")
    targetQuantity = request.POST.get("target_quantity")

    res = {"success": False, "data": None}

    if (
        trade_plan_id == None
        or sid == None
        or planType == None
        or targetPrice == None
        or targetQuantity == None
    ):
        res["error"] = "Data not sufficient."
    else:
        c, created = Company.objects.get_or_create(
            pk=sid, defaults={"name": getCompanyName(sid)}
        )
        p: TradePlan = TradePlan.objects.get(pk=trade_plan_id)
        p.company = c
        p.plan_type = planType
        p.target_price = targetPrice
        p.target_quantity = targetQuantity
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

    return JsonResponse(res)


@csrf_exempt
@require_POST
@require_login
def delete_trade_plan(request: HttpRequest):
    trade_plan_id = request.POST.get("id")

    res = {"success": False}

    if trade_plan_id == None:
        res["error"] = "Data not sufficient."
    else:
        TradePlan.objects.get(pk=trade_plan_id).delete()
        res["success"] = True

    return JsonResponse(res)
