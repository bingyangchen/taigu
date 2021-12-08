from .models import StockMemo


class StockMemoView:
    def __init__(self):
        pass

    def createMemo(self, sid, mainGoodsOrServices, strategyUsed, myNote):
        memo = StockMemo(sid=sid, mainGoodsOrServices=mainGoodsOrServices,
                         strategyUsed=strategyUsed, myNote=myNote)
        memo.save()

    def readMemo(self, sidList):
        dictResultList = []
        for each in sidList:
            temp = StockMemo.objects.filter(sid=each)
            for each in temp:
                dictResultList.append({
                    "id": each.id,
                    "sid": each.sid,
                    "main-goods-or-services": each.mainGoodsOrServices,
                    "strategy-used": each.strategyUsed,
                    "my-note": each.myNote
                })
        return dictResultList

    def updateMemo(self, ID, mainGoodsOrServices, strategyUsed, myNote):
        target = StockMemo.objects.get(id=ID)
        target.mainGoodsOrServices = mainGoodsOrServices
        target.strategyUsed = strategyUsed
        target.myNote = myNote
        target.save()

    def deleteMemo(self, ID):
        target = StockMemo.objects.get(id=ID)
        target.delete()
