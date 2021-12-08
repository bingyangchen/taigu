from .models import TradePlan


class TradePlanView:
    def __init__(self):
        pass

    def createPlan(self, sid, planType, targetPrice, targetQuantity):
        plan = TradePlan(sid=sid, planType=planType, targetPrice=targetPrice,
                         targetQuantity=targetQuantity)
        plan.save()

    def readPlan(self, sidList):
        dictResultList = []
        for each in sidList:
            temp = TradePlan.objects.filter(sid=each)
            for each in temp:
                dictResultList.append({
                    "id": each.id,
                    "sid": each.sid,
                    "plan-type": each.planType,
                    "target-price": each.targetPrice,
                    "target-quantity": each.targetQuantity
                })
        return dictResultList

    def updatePlan(self, ID, planType, targetPrice, targetQuantity):
        target = TradePlan.objects.get(id=ID)
        target.planType = planType
        target.targetPrice = targetPrice
        target.targetQuantity = targetQuantity
        target.save()

    def deletePlan(self, ID):
        target = TradePlan.objects.get(id=ID)
        target.delete()
