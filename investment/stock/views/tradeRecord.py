import json
from datetime import datetime

from django.http import HttpRequest, JsonResponse

from ...decorators import require_login
from ..models import Company, TradeRecord
from ..utils import UnknownStockIdError, fetch_company_info


@require_login
def create_or_list(request: HttpRequest):
    res = {"success": False, "data": None}
    if request.method == "POST":
        payload = json.loads(request.body)
        if (
            (not (deal_time := payload.get("deal_time")))
            or (not (sid := payload.get("sid")))
            or ((deal_price := payload.get("deal_price")) == None)
            or ((deal_quantity := payload.get("deal_quantity")) == None)
            or ((handling_fee := payload.get("handling_fee")) == None)
        ):
            res["error"] = "Data Not Sufficient"
        else:
            sid = str(sid)
            try:
                company_info = fetch_company_info(sid)
                c, created = Company.objects.get_or_create(
                    pk=sid,
                    defaults={
                        "name": company_info["name"],
                        "trade_type": company_info["trade_type"],
                    },
                )
                tr = TradeRecord.objects.create(
                    owner=request.user,
                    company=c,
                    deal_time=datetime.strptime(str(deal_time), "%Y-%m-%d").date(),
                    deal_price=float(deal_price),
                    deal_quantity=int(deal_quantity),
                    handling_fee=int(handling_fee),
                )
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


@require_login
def update_or_delete(request: HttpRequest, id):
    res = {"success": False, "data": None}
    id = int(id)

    if request.method == "POST":
        payload = json.loads(request.body)
        if (
            (not (deal_time := payload.get("deal_time")))
            or (not (sid := payload.get("sid")))
            or ((deal_price := payload.get("deal_price")) == None)
            or ((deal_quantity := payload.get("deal_quantity")) == None)
            or ((handling_fee := payload.get("handling_fee")) == None)
        ):
            res["error"] = "Data Not Sufficient"
        else:
            sid = str(sid)
            try:
                company_info = fetch_company_info(sid)
                c, created = Company.objects.get_or_create(
                    pk=sid,
                    defaults={
                        "name": company_info["name"],
                        "trade_type": company_info["trade_type"],
                    },
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
