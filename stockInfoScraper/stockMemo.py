from .models import StockMemo, TradeRecord
from django.db.models import Sum

class StockMemoView:
    def __init__(self):
        pass

    def createMemo(self, sid, mainGoodsOrServices, strategyUsed, myNote):
        memo = StockMemo(sid=sid, mainGoodsOrServices=mainGoodsOrServices,
                         strategyUsed=strategyUsed, myNote=myNote)
        memo.save()

    def readMemo(self, sidList):
        dictResultList = []
        if sidList == []:
            autoSidQuery = TradeRecord.objects.values('sid').annotate(sum=Sum('dealQuantity')).filter(sum__gt=0).values('sid')
            for each in autoSidQuery:
                sidList.append(each["sid"])
        q = StockMemo.objects.filter(sid__in=sidList)
        for each in q:
            dictResultList.append({
                "id": each.id,
                "sid": each.sid,
                "main-goods-or-services": each.mainGoodsOrServices,
                "strategy-used": each.strategyUsed,
                "my-note": each.myNote
            })
        return dictResultList

    def updateMemo(self, ID, mainGoodsOrServices, strategyUsed, myNote):
        StockMemo.objects.filter(id=ID).update(
            mainGoodsOrServices = mainGoodsOrServices,
            strategyUsed = strategyUsed,
            myNote = myNote
        )

    def deleteMemo(self, ID):
        target = StockMemo.objects.get(id=ID)
        target.delete()
