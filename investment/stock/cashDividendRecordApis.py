from datetime import datetime
import json

from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST

from .utils import getCompanyName
from .models import cash_dividend_record, company
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
    cashDividend = request.POST.get("cash-dividend")

    res = {"error-message": "", "status": "failed", "data": []}

    if mode == "create":
        if dealTime == None or sid == None or cashDividend == None:
            res["error-message"] = "Data not sufficient."
        else:
            helper.create(request.user, str(dealTime), str(sid), int(cashDividend))
            res["status"] = "succeeded"
    elif mode == "read":
        dealTimeList = json.loads(request.POST.get("deal-time-list", "[]"))
        sidList = json.loads(request.POST.get("sid-list", "[]"))
        res["data"] = helper.read(request.user, dealTimeList, sidList)
        res["status"] = "succeeded"
    elif mode == "update":
        if _id == None or dealTime == None or sid == None or cashDividend == None:
            res["error-message"] = "Data not sufficient."
        else:
            helper.update(_id, str(dealTime), str(sid), int(cashDividend))
            res["status"] = "succeeded"
    elif mode == "delete":
        if _id == None:
            res["error-message"] = "Data not sufficient."
        else:
            helper.delete(_id)
            res["status"] = "succeeded"
    else:
        res["error-message"] = "Mode {} Not Exist".format(mode)

    return JsonResponse(res)


class Helper:
    def __init__(self):
        pass

    def create(self, user, dealTime: str, sid: str, cashDividend: int):
        c, created = company.objects.get_or_create(
            pk=sid, defaults={"name": getCompanyName(sid)}
        )
        cash_dividend_record.objects.create(
            owner=user,
            company=c,
            deal_time=datetime.strptime(dealTime, "%Y-%m-%d").date(),
            cash_dividend=cashDividend,
        )

    def read(self, user, dealTimeList, sidList):
        if dealTimeList != [] or sidList != []:
            if dealTimeList != [] and sidList != []:
                query = user.cash_dividend_records.filter(
                    deal_time__in=dealTimeList
                ).filter(company__pk__in=sidList)
            elif dealTimeList == []:
                query = user.cash_dividend_records.filter(company__pk__in=sidList)
            else:
                query = user.cash_dividend_records.filter(deal_time__in=dealTimeList)
        else:
            query = user.cash_dividend_records.all()
        query = query.order_by("-deal_time")

        result = []
        for each in query:
            result.append(
                {
                    "id": each.pk,
                    "deal-time": each.deal_time,
                    "sid": each.company.pk,
                    "company-name": each.company.name,
                    "cash-dividend": each.cash_dividend,
                }
            )
        return result

    def update(self, _id, dealTime: str, sid: str, cashDividend: int):
        c, created = company.objects.get_or_create(
            pk=sid, defaults={"name": getCompanyName(sid)}
        )
        cash_dividend_record.objects.filter(pk=_id).update(
            company=c,
            deal_time=datetime.strptime(dealTime, "%Y-%m-%d").date(),
            cash_dividend=cashDividend,
        )

    def delete(self, _id):
        cash_dividend_record.objects.get(pk=_id).delete()
