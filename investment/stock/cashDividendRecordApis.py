from datetime import datetime
import json

from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST

from investment.account.models import user as User
from .utils import getCompanyName
from .models import cash_dividend_record as CashDividendRecord, company as Company
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
    cashDividend = request.POST.get("cash_dividend")

    res = {"error": "", "success": False, "data": None}

    if mode == "create":
        if dealTime == None or sid == None or cashDividend == None:
            res["error"] = "Data not sufficient."
        else:
            res["data"] = helper.create(
                request.user, str(dealTime), str(sid), int(cashDividend)
            )
            res["success"] = True
    elif mode == "read":
        dealTimeList = json.loads(request.POST.get("deal_time_list", "[]"))
        sidList = json.loads(request.POST.get("sid_list", "[]"))
        res["data"] = helper.read(request.user, dealTimeList, sidList)
        res["success"] = True
    elif mode == "update":
        if _id == None or dealTime == None or sid == None or cashDividend == None:
            res["error"] = "Data not sufficient."
        else:
            res["data"] = helper.update(_id, str(dealTime), str(sid), int(cashDividend))
            res["success"] = True
    elif mode == "delete":
        if _id == None:
            res["error"] = "Data not sufficient."
        else:
            helper.delete(_id)
            res["success"] = True
    else:
        res["error"] = f"Mode {mode} Not Exist"

    return JsonResponse(res)


class Helper:
    def __init__(self):
        pass

    def create(self, user: User, dealTime: str, sid: str, cashDividend: int):
        c, created = Company.objects.get_or_create(
            pk=sid, defaults={"name": getCompanyName(sid)}
        )
        r = CashDividendRecord.objects.create(
            owner=user,
            company=c,
            deal_time=datetime.strptime(dealTime, "%Y-%m-%d").date(),
            cash_dividend=cashDividend,
        )
        return {
            "id": r.pk,
            "deal_time": r.deal_time,
            "sid": r.company.pk,
            "company_name": r.company.name,
            "cash_dividend": r.cash_dividend,
        }

    def read(self, user: User, dealTimeList, sidList):
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
                    "deal_time": each.deal_time,
                    "sid": each.company.pk,
                    "company_name": each.company.name,
                    "cash_dividend": each.cash_dividend,
                }
            )
        return result

    def update(self, _id, dealTime: str, sid: str, cashDividend: int):
        c, created = Company.objects.get_or_create(
            pk=sid, defaults={"name": getCompanyName(sid)}
        )
        r = CashDividendRecord.objects.get(pk=_id)
        r.company = c
        r.deal_time = datetime.strptime(dealTime, "%Y-%m-%d").date()
        r.cash_dividend = cashDividend
        r.save()
        return {
            "id": r.pk,
            "deal_time": r.deal_time,
            "sid": r.company.pk,
            "company_name": r.company.name,
            "cash_dividend": r.cash_dividend,
        }

    def delete(self, _id):
        CashDividendRecord.objects.get(pk=_id).delete()
