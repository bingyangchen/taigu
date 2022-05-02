import json
import datetime

from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST

from .utils import getCompanyName
from .models import trade_record, company
from ..account.models import user as User
from ..decorators import cors_exempt, require_login


@csrf_exempt
@cors_exempt
@require_POST
@require_login
def crud(request):
    helper = Helper()

    mode = request.POST.get("mode")
    _id = request.POST.get("id")
    dealTime = request.POST.get("deal-time")
    sid = request.POST.get("sid")
    dealPrice = request.POST.get("deal-price")
    dealQuantity = request.POST.get("deal-quantity")
    handlingFee = request.POST.get("handling-fee")

    res = {"error-message": "", "status": "failed", "data": []}
    if mode == "create":
        if (
            dealTime == None
            or sid == None
            or dealPrice == None
            or dealQuantity == None
            or handlingFee == None
        ):
            res["error-message"] = "Data not sufficient."
        else:
            dealTime = datetime.datetime.strptime(dealTime, "%Y-%m-%d").date()
            helper.create(
                request.user,
                dealTime,
                str(sid),
                float(dealPrice),
                int(dealQuantity),
                int(handlingFee),
            )
            res["status"] = "succeeded"
    elif mode == "read":
        dealTimeList = [
            datetime.datetime.strptime(each, "%Y-%m-%d").date()
            for each in json.loads(request.POST.get("deal-time-list", "[]"))
        ]
        sidList = json.loads(request.POST.get("sid-list", "[]"))
        res["data"] = helper.read(request.user, dealTimeList, sidList)
        res["status"] = "succeeded"
    elif mode == "update":
        if (
            _id == None
            or dealTime == None
            or sid == None
            or dealPrice == None
            or dealQuantity == None
            or handlingFee == None
        ):
            res["error-message"] = "Data not sufficient."
        else:
            dealTime = datetime.datetime.strptime(dealTime, "%Y-%m-%d").date()
            helper.update(
                _id,
                dealTime,
                str(sid),
                float(dealPrice),
                int(dealQuantity),
                int(handlingFee),
            )
            res["status"] = "succeeded"
    elif mode == "delete":
        if _id == None:
            res["error-message"] = "Data not sufficient."
        else:
            helper.delete(_id)
            res["status"] = "succeeded"
    else:
        res["error-message"] = "Mode Not Exsist"

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
        c, created = company.objects.get_or_create(
            pk=sid, defaults={"name": getCompanyName(sid)}
        )
        trade_record.objects.create(
            owner=user,
            company=c,
            deal_time=dealTime,
            deal_price=float(dealPrice),
            deal_quantity=int(dealQuantity),
            handling_fee=int(handlingFee),
        )

    def read(self, user: User, dealTimeList, sidList):
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
                    "deal-time": each.deal_time,
                    "sid": each.company.pk,
                    "company-name": each.company.name,
                    "deal-price": each.deal_price,
                    "deal-quantity": each.deal_quantity,
                    "handling-fee": each.handling_fee,
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
        c, created = company.objects.get_or_create(
            pk=sid, defaults={"name": getCompanyName(sid)}
        )
        trade_record.objects.filter(pk=_id).update(
            company=c,
            deal_time=dealTime,
            deal_price=float(dealPrice),
            deal_quantity=int(dealQuantity),
            handling_fee=int(handlingFee),
        )

    def delete(self, _id):
        trade_record.objects.get(pk=_id).delete()
