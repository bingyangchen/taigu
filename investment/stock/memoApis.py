import json

from django.db.models import Sum
from django.http import JsonResponse, HttpRequest
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST

from investment.account.models import user as User

from .models import stock_memo as StockMemo, company as Company
from .utils import getCompanyName
from ..decorators import require_login


@csrf_exempt
@require_POST
@require_login
def crud(request: HttpRequest):
    helper = Helper()

    mode = request.POST.get("mode")
    _id = request.POST.get("id")
    sid = request.POST.get("sid")
    business = request.POST.get("business")
    strategy = request.POST.get("strategy")
    note = request.POST.get("note")

    res = {"error": "", "success": False, "data": []}

    if mode == "create":
        if sid == None:
            res["error"] = "Data not sufficient."
        else:
            res["data"] = helper.create(
                request.user, str(sid), str(business), str(strategy), str(note)
            )
            res["success"] = True
    elif mode == "read":
        sidList = json.loads(request.POST.get("sid-list", "[]"))
        res["data"] = helper.read(request.user, sidList)
        res["success"] = True
    elif mode == "update":
        if _id == None:
            res["error"] = "Data not sufficient."
        else:
            res["data"] = helper.update(_id, str(business), str(strategy), str(note))
            res["success"] = True
    elif mode == "delete":
        if _id == None:
            res["error"] = "Data not sufficient."
        else:
            helper.delete(_id)
            res["success"] = True
    else:
        res["error"] = "Mode {} Not Exist".format(mode)

    return JsonResponse(res)


class Helper:
    def __init__(self):
        pass

    def create(
        self,
        user: User,
        sid: str,
        business: str,
        strategy: str,
        note: str,
    ):
        c, created = Company.objects.get_or_create(
            pk=sid, defaults={"name": getCompanyName(sid)}
        )
        m: StockMemo = StockMemo.objects.create(
            owner=user,
            company=c,
            business=business,
            strategy=strategy,
            note=note,
        )
        return {
            "id": m.pk,
            "sid": m.company.pk,
            "company_name": m.company.name,
            "business": m.business,
            "strategy": m.strategy,
            "note": m.note,
        }

    def read(self, user: User, sidList):
        result = []
        if sidList != []:
            query = user.stock_memos.filter(company__pk__in=sidList)
        else:
            query = user.stock_memos.all()
        for each in query:
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
        return result

    def update(self, _id: str, business: str, strategy: str, note: str):
        m: StockMemo = StockMemo.objects.get(pk=_id)
        m.business = business
        m.strategy = strategy
        m.note = note
        m.save()
        return {
            "id": m.pk,
            "sid": m.company.pk,
            "company_name": m.company.name,
            "business": m.business,
            "strategy": m.strategy,
            "note": m.note,
        }

    def delete(self, _id):
        StockMemo.objects.get(pk=_id).delete()
