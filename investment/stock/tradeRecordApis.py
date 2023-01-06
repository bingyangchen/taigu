import json
import datetime
from typing import List

from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST

from .utils import getCompanyName
from .models import trade_record as TradeRecord, company as Company
from ..account.models import user as User
from ..decorators import require_login


@csrf_exempt
@require_POST
@require_login
def crud(request):
    helper = Helper()

    mode = request.POST.get("mode")
    _id = request.POST.get("id")
    dealTime = request.POST.get("deal_time")
    sid = request.POST.get("sid")
    dealPrice = request.POST.get("deal_price")
    dealQuantity = request.POST.get("deal_quantity")
    handlingFee = request.POST.get("handling_fee")

    res = {"error": "", "success": False, "data": None}
    if mode == "create":
        if (
            dealTime == None
            or sid == None
            or dealPrice == None
            or dealQuantity == None
            or handlingFee == None
        ):
            res["error"] = "Data not sufficient."
        else:
            dealTime = datetime.datetime.strptime(dealTime, "%Y-%m-%d").date()
            res["data"] = helper.create(
                request.user,
                dealTime,
                str(sid),
                float(dealPrice),
                int(dealQuantity),
                int(handlingFee),
            )
            res["success"] = True
    elif mode == "read":
        dealTimeList = [
            datetime.datetime.strptime(each, "%Y-%m-%d").date()
            for each in json.loads(request.POST.get("deal_time_list", "[]"))
        ]
        sidList = json.loads(request.POST.get("sid_list", "[]"))
        res["data"] = helper.read(request.user, dealTimeList, sidList)
        res["success"] = True
    elif mode == "update":
        if (
            _id == None
            or dealTime == None
            or sid == None
            or dealPrice == None
            or dealQuantity == None
            or handlingFee == None
        ):
            res["error"] = "Data not sufficient."
        else:
            dealTime = datetime.datetime.strptime(dealTime, "%Y-%m-%d").date()
            res["data"] = helper.update(
                _id,
                dealTime,
                str(sid),
                float(dealPrice),
                int(dealQuantity),
                int(handlingFee),
            )
            res["success"] = True
    elif mode == "delete":
        if _id == None:
            res["error"] = "Data not sufficient."
        else:
            helper.delete(_id)
            res["success"] = True
    else:
        res["error"] = "Mode Not Exsist"

    return JsonResponse(res)


class Helper:
    def __init__(self):
        pass

    def create(
        self,
        user: User,
        dealTime: datetime.date,
        sid: str,
        dealPrice: float,
        dealQuantity: int,
        handlingFee: int,
    ):
        c, created = Company.objects.get_or_create(
            pk=sid, defaults={"name": getCompanyName(sid)}
        )
        r = TradeRecord.objects.create(
            owner=user,
            company=c,
            deal_time=dealTime,
            deal_price=float(dealPrice),
            deal_quantity=int(dealQuantity),
            handling_fee=int(handlingFee),
        )
        return {
            "id": r.pk,
            "deal_time": r.deal_time,
            "sid": r.company.pk,
            "company_name": r.company.name,
            "deal_price": r.deal_price,
            "deal_quantity": r.deal_quantity,
            "handling_fee": r.handling_fee,
        }

    def read(self, user: User, dealTimeList, sidList) -> List:
        if dealTimeList != [] or sidList != []:
            if dealTimeList != [] and sidList != []:
                result = user.trade_records.filter(deal_time__in=dealTimeList).filter(
                    company__pk__in=sidList
                )
            elif dealTimeList == []:
                result = user.trade_records.filter(company__pk__in=sidList)
            else:
                result = user.trade_records.filter(deal_time__in=dealTimeList)
        else:
            result = user.trade_records.all()
        result = result.order_by("-deal_time", "-created_at")
        dictResultList = []
        for each in result:
            dictResultList.append(
                {
                    "id": each.pk,
                    "deal_time": each.deal_time,
                    "sid": each.company.pk,
                    "company_name": each.company.name,
                    "deal_price": each.deal_price,
                    "deal_quantity": each.deal_quantity,
                    "handling_fee": each.handling_fee,
                }
            )
        return dictResultList

    def update(
        self,
        _id,
        dealTime: datetime.date,
        sid: str,
        dealPrice: float,
        dealQuantity: int,
        handlingFee: int,
    ):
        c, created = Company.objects.get_or_create(
            pk=sid, defaults={"name": getCompanyName(sid)}
        )
        r = TradeRecord.objects.get(pk=_id)
        r.company = c
        r.deal_time = dealTime
        r.deal_price = float(dealPrice)
        r.deal_quantity = int(dealQuantity)
        r.handling_fee = int(handlingFee)
        r.save()
        return {
            "id": r.pk,
            "deal_time": r.deal_time,
            "sid": r.company.pk,
            "company_name": r.company.name,
            "deal_price": r.deal_price,
            "deal_quantity": r.deal_quantity,
            "handling_fee": r.handling_fee,
        }

    def delete(self, _id):
        TradeRecord.objects.get(pk=_id).delete()
