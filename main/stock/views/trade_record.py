import json
from datetime import datetime

from django.http import HttpRequest, JsonResponse

from main.core.decorators import require_login

from .. import UnknownStockIdError
from ..models import Company, TradeRecord
from ..utils import fetch_company_info


@require_login
def create_or_list(request: HttpRequest):
    result = {"success": False, "data": None}
    if request.method == "POST":
        payload = json.loads(request.body)
        if (
            (not (deal_time := payload.get("deal_time")))
            or (not (sid := payload.get("sid")))
            or ((deal_price := payload.get("deal_price")) is None)
            or ((deal_quantity := payload.get("deal_quantity")) is None)
            or ((handling_fee := payload.get("handling_fee")) is None)
        ):
            result["error"] = "Data Not Sufficient"
        else:
            sid = str(sid)
            try:
                company_info = fetch_company_info(sid)
                company, created = Company.objects.get_or_create(
                    pk=sid,
                    defaults={**company_info},
                )
                record = TradeRecord.objects.create(
                    owner=request.user,
                    company=company,
                    deal_time=datetime.strptime(str(deal_time), "%Y-%m-%d").date(),
                    deal_price=float(deal_price),
                    deal_quantity=int(deal_quantity),
                    handling_fee=int(handling_fee),
                )
                result["data"] = {
                    "id": record.pk,
                    "deal_time": record.deal_time,
                    "sid": record.company.pk,
                    "company_name": record.company.name,
                    "deal_price": record.deal_price,
                    "deal_quantity": record.deal_quantity,
                    "handling_fee": record.handling_fee,
                }
                result["success"] = True
            except UnknownStockIdError as e:
                result["error"] = str(e)
    elif request.method == "GET":
        deal_times = [
            datetime.strptime(d, "%Y-%m-%d").date()
            for d in json.loads(request.GET.get("deal_times", "[]"))
        ]
        sids = json.loads(request.GET.get("sids", "[]"))

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

        query_set = query_set.order_by("-deal_time", "-created_at")

        result["data"] = [
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
        result["success"] = True
    else:
        result["error"] = "Method Not Allowed"
    return JsonResponse(result)


@require_login
def update_or_delete(request: HttpRequest, id):
    result = {"success": False, "data": None}
    id = int(id)

    if request.method == "POST":
        payload = json.loads(request.body)
        if (
            (not (deal_time := payload.get("deal_time")))
            or (not (sid := payload.get("sid")))
            or ((deal_price := payload.get("deal_price")) is None)
            or ((deal_quantity := payload.get("deal_quantity")) is None)
            or ((handling_fee := payload.get("handling_fee")) is None)
        ):
            result["error"] = "Data Not Sufficient"
        else:
            sid = str(sid)
            try:
                company_info = fetch_company_info(sid)
                company, created = Company.objects.get_or_create(
                    pk=sid,
                    defaults={**company_info},
                )
                record = TradeRecord.objects.get(pk=id)
                record.company = company
                record.deal_time = datetime.strptime(str(deal_time), "%Y-%m-%d").date()
                record.deal_price = float(deal_price)
                record.deal_quantity = int(deal_quantity)
                record.handling_fee = int(handling_fee)
                record.save()
                result["data"] = {
                    "id": record.pk,
                    "deal_time": record.deal_time,
                    "sid": record.company.pk,
                    "company_name": record.company.name,
                    "deal_price": record.deal_price,
                    "deal_quantity": record.deal_quantity,
                    "handling_fee": record.handling_fee,
                }
                result["success"] = True
            except UnknownStockIdError as e:
                result["error"] = str(e)
    elif request.method == "DELETE":
        TradeRecord.objects.get(pk=id).delete()
        result["success"] = True
    else:
        result["error"] = "Method Not Allowed"
    return JsonResponse(result)
