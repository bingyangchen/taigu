import json
from datetime import datetime

from django.http import JsonResponse, HttpRequest
from django.views.decorators.csrf import csrf_exempt

from ..utils import getCompanyName, validateStockId, UnknownStockIdError
from ..models import TradeRecord, Company
from ...decorators import require_login


@csrf_exempt
@require_login
def create_or_list_trade_record(request: HttpRequest):
    res = {"success": False, "data": None}
    if request.method == "POST":
        payload = json.loads(request.body)

        deal_time = payload.get("deal_time")
        sid = payload.get("sid")
        deal_price = payload.get("deal_price")
        deal_quantity = payload.get("deal_quantity")
        handling_fee = payload.get("handling_fee")

        if (
            (not deal_time)
            or (not sid)
            or deal_price == None
            or deal_quantity == None
            or handling_fee == None
        ):
            res["error"] = "Data not sufficient"
        else:
            sid = str(sid)
            try:
                validateStockId(sid)
                c, created = Company.objects.get_or_create(
                    pk=sid, defaults={"name": getCompanyName(sid)}
                )
                r = TradeRecord.objects.create(
                    owner=request.user,
                    company=c,
                    deal_time=datetime.strptime(str(deal_time), "%Y-%m-%d").date(),
                    deal_price=float(deal_price),
                    deal_quantity=int(deal_quantity),
                    handling_fee=int(handling_fee),
                )
                res["data"] = {
                    "id": r.pk,
                    "deal_time": r.deal_time,
                    "sid": r.company.pk,
                    "company_name": r.company.name,
                    "deal_price": r.deal_price,
                    "deal_quantity": r.deal_quantity,
                    "handling_fee": r.handling_fee,
                }
                res["success"] = True
            except UnknownStockIdError as e:
                res["error"] = str(e)
    elif request.method == "GET":
        deal_time_list = [
            datetime.strptime(d, "%Y-%m-%d").date()
            for d in json.loads(request.GET.get("deal_time_list", "[]"))
        ]
        sid_list = json.loads(request.GET.get("sid_list", "[]"))

        if deal_time_list != [] or sid_list != []:
            if deal_time_list != [] and sid_list != []:
                queryset = request.user.trade_records.filter(
                    deal_time__in=deal_time_list
                ).filter(company__pk__in=sid_list)
            elif deal_time_list == []:
                queryset = request.user.trade_records.filter(company__pk__in=sid_list)
            else:
                queryset = request.user.trade_records.filter(
                    deal_time__in=deal_time_list
                )
        else:
            queryset = request.user.trade_records.all()

        queryset = queryset.order_by("-deal_time", "-created_at")

        result = []
        for tr in queryset:
            result.append(
                {
                    "id": tr.pk,
                    "deal_time": tr.deal_time,
                    "sid": tr.company.pk,
                    "company_name": tr.company.name,
                    "deal_price": tr.deal_price,
                    "deal_quantity": tr.deal_quantity,
                    "handling_fee": tr.handling_fee,
                }
            )
        res["data"] = result
        res["success"] = True
    else:
        res["error"] = "Method Not Allowed"
    return JsonResponse(res)


@csrf_exempt
@require_login
def update_or_delete_trade_record(request: HttpRequest, id):
    res = {"success": False, "data": None}
    id = int(id)

    if request.method == "POST":
        payload = json.loads(request.body)

        deal_time = payload.get("deal_time")
        sid = payload.get("sid")
        deal_price = payload.get("deal_price")
        deal_quantity = payload.get("deal_quantity")
        handling_fee = payload.get("handling_fee")
        if (
            (not deal_time)
            or (not sid)
            or deal_price == None
            or deal_quantity == None
            or handling_fee == None
        ):
            res["error"] = "Data not sufficient."
        else:
            sid = str(sid)
            try:
                validateStockId(sid)
                c, created = Company.objects.get_or_create(
                    pk=sid, defaults={"name": getCompanyName(sid)}
                )
                tr = TradeRecord.objects.get(pk=id)
                tr.company = c
                tr.deal_time = datetime.strptime(str(deal_time), "%Y-%m-%d").date()
                tr.deal_price = float(deal_price)
                tr.deal_quantity = int(deal_quantity)
                tr.handling_fee = int(handling_fee)
                tr.save()
                res["data"] = {
                    "id": tr.pk,
                    "deal_time": tr.deal_time,
                    "sid": tr.company.pk,
                    "company_name": tr.company.name,
                    "deal_price": tr.deal_price,
                    "deal_quantity": tr.deal_quantity,
                    "handling_fee": tr.handling_fee,
                }
                res["success"] = True
            except UnknownStockIdError as e:
                res["error"] = str(e)
    elif request.method == "DELETE":
        TradeRecord.objects.get(pk=id).delete()
        res["success"] = True
    else:
        res["error"] = "Method Not Allowed"
    return JsonResponse(res)
