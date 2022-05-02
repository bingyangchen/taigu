import json

from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST

from .utils import getCompanyName
from .models import trade_plan, company
from ..decorators import cors_exempt, require_login


@csrf_exempt
@cors_exempt
@require_POST
@require_login
def crud(request):
    helper = Helper()

    mode = request.POST.get("mode")
    _id = request.POST.get("id")
    planType = request.POST.get("plan-type")
    targetPrice = request.POST.get("target-price")
    targetQuantity = request.POST.get("target-quantity")

    res = {"error-message": "", "status": "failed", "data": []}
    if mode == "create":
        sid = request.POST.get("sid")
        if sid == None:
            res["error-message"] = "Data not sufficient."
        else:
            helper.create(
                request.user,
                str(sid),
                str(planType),
                float(targetPrice),
                int(targetQuantity),
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
            helper.update(_id, str(planType), float(targetPrice), int(targetQuantity))
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

    def create(
        self, user, sid: str, planType: str, targetPrice: float, targetQuantity: int
    ):
        c, created = company.objects.get_or_create(
            pk=sid, defaults={"name": getCompanyName(sid)}
        )
        trade_plan.objects.create(
            owner=user,
            company=c,
            plan_type=planType,
            target_price=targetPrice,
            target_quantity=targetQuantity,
        )

    def read(self, user, sidList):
        result = []
        if sidList == []:
            query = user.trade_plans.all()
        else:
            query = user.trade_plans.filter(company__pk__in=sidList)
        for each in query:
            result.append(
                {
                    "id": each.pk,
                    "sid": each.company.pk,
                    "company-name": each.company.name,
                    "plan-type": each.plan_type,
                    "target-price": each.target_price,
                    "target-quantity": each.target_quantity,
                }
            )
        return result

    def update(self, _id, planType: str, targetPrice: float, targetQuantity: int):
        trade_plan.objects.filter(pk=_id).update(
            plan_type=planType, target_price=targetPrice, target_quantity=targetQuantity
        )

    def delete(self, _id):
        trade_plan.objects.get(pk=_id).delete()
