import json

from django.db.models import Sum
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST

from .models import stock_memo, company
from .utils import getCompanyName
from ..decorators import require_login


@csrf_exempt
@require_POST
@require_login
def crud(request):
    helper = Helper()

    mode = request.POST.get("mode")
    _id = request.POST.get("id")
    sid = request.POST.get("sid")
    business = request.POST.get("business")
    strategy = request.POST.get("strategy")
    note = request.POST.get("note")

    res = {"error-message": "", "status": "failed", "data": []}

    if mode == "create":
        if sid == None:
            res["error-message"] = "Data not sufficient."
        else:
            helper.create(
                request.user, str(sid), str(business), str(strategy), str(note)
            )
            res["status"] = "succeeded"
    elif mode == "read":
        sidList = json.loads(request.POST.get("sid-list", "[]"))
        res["data"] = helper.read(request.user, sidList)
        res["status"] = "succeeded"
    elif mode == "update":
        if _id == None:
            res["error-message"] = "Data not sufficient."
        else:
            helper.update(_id, str(business), str(strategy), str(note))
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

    def create(self, user, sid: str, business: str, strategy: str, note: str):
        c, created = company.objects.get_or_create(
            pk=sid, defaults={"name": getCompanyName(sid)}
        )
        stock_memo.objects.create(
            owner=user, company=c, business=business, strategy=strategy, note=note
        )

    def read(self, user, sidList):
        result = []
        if sidList == []:
            autoSidQuery = (
                user.trade_records.values("company__pk")
                .annotate(sum=Sum("deal_quantity"))
                .filter(sum__gt=0)
                .values("company__pk")
            )
            for each in autoSidQuery:
                sidList.append(each["company__pk"])
        query = user.stock_memos.filter(company__pk__in=sidList)
        for each in query:
            result.append(
                {
                    "id": each.pk,
                    "sid": each.company.pk,
                    "business": each.business,
                    "strategy": each.strategy,
                    "note": each.note,
                }
            )
        return result

    def update(self, _id, business: str, strategy: str, note: str):
        stock_memo.objects.filter(pk=_id).update(
            business=business,
            strategy=strategy,
            note=note,
        )

    def delete(self, _id):
        stock_memo.objects.get(pk=_id).delete()
