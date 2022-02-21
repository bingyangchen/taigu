from .utils import getCompanyName
from .models import trade_plan, company
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from .my_decorators import cors_exempt


@csrf_exempt
@cors_exempt
def planCRUD(request):
    if request.method == "POST":
        s = TradePlanView()
        mode = request.POST.get("mode")
        ID = request.POST.get("id")
        sid = request.POST.get("sid")
        planType = request.POST.get("plan-type")
        targetPrice = request.POST.get("target-price")
        targetQuantity = request.POST.get("target-quantity")
        if mode == "create":
            if sid == None:
                result = {"error-message": "Data not sufficient."}
            else:
                s.createPlan(sid, planType, targetPrice, targetQuantity)
                result = {"success-message": "creation-success"}
        elif mode == "read":
            sidList = request.POST.get("sid-list", default=[])
            sidList = sidList.split(",") if len(sidList) > 0 else sidList
            result = {"data": s.readPlan(sidList)}
        elif mode == "update":
            if ID == None:
                result = {"error-message": "Data not sufficient."}
            else:
                s.updatePlan(ID, planType, targetPrice, targetQuantity)
                result = {"success-message": "update-success"}
        elif mode == "delete":
            if ID == None:
                result = {"error-message": "Data not sufficient."}
            else:
                s.deletePlan(ID)
                result = {"success-message": "deletion-success"}
        else:
            result = {"error-message": "Mode %s Not Exist" % mode}
    else:
        result = {"error-message": "Only POST methods are available."}
    response = JsonResponse(result)
    return response


class TradePlanView:
    def __init__(self):
        pass

    def createPlan(self, sid, planType, targetPrice, targetQuantity):
        c, created = company.objects.get_or_create(
            stock_id=sid, defaults={"name": getCompanyName(sid)}
        )
        plan = trade_plan.objects.create(
            company=c,
            plan_type=planType,
            target_price=targetPrice,
            target_quantity=targetQuantity,
        )

    def readPlan(self, sidList):
        dictResultList = []
        if sidList == []:
            q = trade_plan.objects.all()
        else:
            q = trade_plan.objects.filter(company__stock_id__in=sidList)
        for each in q:
            dictResultList.append(
                {
                    "id": each.id,
                    "sid": each.company.stock_id,
                    "plan-type": each.plan_type,
                    "target-price": each.target_price,
                    "target-quantity": each.target_quantity,
                }
            )
        return dictResultList

    def updatePlan(self, ID, planType, targetPrice, targetQuantity):
        trade_plan.objects.filter(id=ID).update(
            plan_type=planType, target_price=targetPrice, target_quantity=targetQuantity
        )

    def deletePlan(self, ID):
        target = trade_plan.objects.get(id=ID)
        target.delete()
