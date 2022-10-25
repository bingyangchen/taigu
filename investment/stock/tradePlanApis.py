import json

from django.http import JsonResponse, HttpRequest
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST

from .utils import getCompanyName
from .models import trade_plan as TradePlan, company as Company
from ..account.models import user as User
from ..decorators import require_login


@csrf_exempt
@require_POST
@require_login
def crud(request: HttpRequest):
    helper = Helper()

    mode = request.POST.get("mode")
    _id = request.POST.get("id")
    sid = request.POST.get("sid")
    planType = request.POST.get("plan_type")
    targetPrice = request.POST.get("target_price")
    targetQuantity = request.POST.get("target_quantity")

    res = {"error": "", "success": False, "data": []}
    if mode == "create":
        if (
            sid == None
            or planType == None
            or targetPrice == None
            or targetQuantity == None
        ):
            res["error"] = "Data not sufficient."
        else:
            res["data"] = helper.create(
                request.user,
                str(sid),
                str(planType),
                float(targetPrice),
                int(targetQuantity),
            )
            res["success"] = True
    elif mode == "read":
        sidList = json.loads(request.POST.get("sid-list", "[]"))
        res["data"] = helper.read(request.user, sidList)
        res["success"] = True
    elif mode == "update":
        if (
            _id == None
            or sid == None
            or planType == None
            or targetPrice == None
            or targetQuantity == None
        ):
            res["error"] = "Data not sufficient."
        else:
            res["data"] = helper.update(
                _id, str(planType), float(targetPrice), int(targetQuantity)
            )
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
        planType: str,
        targetPrice: float,
        targetQuantity: int,
    ):
        c, created = Company.objects.get_or_create(
            pk=sid, defaults={"name": getCompanyName(sid)}
        )
        p: TradePlan = TradePlan.objects.create(
            owner=user,
            company=c,
            plan_type=planType,
            target_price=targetPrice,
            target_quantity=targetQuantity,
        )
        return {
            "id": p.pk,
            "sid": p.company.pk,
            "company_name": p.company.name,
            "plan_type": p.plan_type,
            "target_price": p.target_price,
            "target_quantity": p.target_quantity,
        }

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
                    "company_name": each.company.name,
                    "plan_type": each.plan_type,
                    "target_price": each.target_price,
                    "target_quantity": each.target_quantity,
                }
            )
        return result

    def update(self, _id, planType: str, targetPrice: float, targetQuantity: int):
        p: TradePlan = TradePlan.objects.get(pk=_id)
        p.plan_type = planType
        p.target_price = targetPrice
        p.target_quantity = targetQuantity
        p.save()
        return {
            "id": p.pk,
            "sid": p.company.pk,
            "company_name": p.company.name,
            "plan_type": p.plan_type,
            "target_price": p.target_price,
            "target_quantity": p.target_quantity,
        }

    def delete(self, _id):
        TradePlan.objects.get(pk=_id).delete()
