from .models import stock_memo, trade_record, company
from django.db.models import Sum
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from .my_decorators import cors_exempt


@csrf_exempt
@cors_exempt
def memoCRUD(request):
    if request.method == "POST":
        s = StockMemoView()
        mode = request.POST.get("mode")
        ID = request.POST.get("id")
        sid = request.POST.get("sid")
        mainGoodsOrServices = request.POST.get("main-goods-or-services")
        strategyUsed = request.POST.get("strategy-used")
        myNote = request.POST.get("my-note")
        if mode == "create":
            if sid == None:
                result = {"error-message": "Data not sufficient."}
            else:
                s.createMemo(sid, mainGoodsOrServices, strategyUsed, myNote)
                result = {"success-message": "creation-success"}
        elif mode == "read":
            sidList = request.POST.get("sid-list", default=[])
            sidList = sidList.split(",") if len(sidList) > 0 else sidList
            result = {"data": s.readMemo(sidList)}
        elif mode == "update":
            if ID == None:
                result = {"error-message": "Data not sufficient."}
            else:
                s.updateMemo(ID, mainGoodsOrServices, strategyUsed, myNote)
                result = {"success-message": "update-success"}
        elif mode == "delete":
            if ID == None:
                result = {"error-message": "Data not sufficient."}
            else:
                s.deleteMemo(ID)
                result = {"success-message": "deletion-success"}
        else:
            result = {"error-message": "Mode %s Not Exist" % mode}
    else:
        result = {"error-message": "Only POST methods are available."}
    response = JsonResponse(result)
    return response


class StockMemoView:
    def __init__(self):
        pass

    def createMemo(self, sid, mainGoodsOrServices, strategyUsed, myNote):
        c = company.objects.get(stock_id=sid)
        memo = stock_memo.objects.create(
            company=c,
            main_goods_or_services=mainGoodsOrServices,
            strategy_used=strategyUsed,
            my_note=myNote,
        )

    def readMemo(self, sidList):
        dictResultList = []
        if sidList == []:
            autoSidQuery = (
                trade_record.objects.values("company__stock_id")
                .annotate(sum=Sum("deal_quantity"))
                .filter(sum__gt=0)
                .values("company__stock_id")
            )
            for each in autoSidQuery:
                sidList.append(each["company__stock_id"])
        q = stock_memo.objects.filter(company__stock_id__in=sidList)
        for each in q:
            dictResultList.append(
                {
                    "id": each.id,
                    "sid": each.company.stock_id,
                    "main-goods-or-services": each.main_goods_or_services,
                    "strategy-used": each.strategy_used,
                    "my-note": each.my_note,
                }
            )
        return dictResultList

    def updateMemo(self, ID, mainGoodsOrServices, strategyUsed, myNote):
        stock_memo.objects.filter(id=ID).update(
            main_goods_or_services=mainGoodsOrServices,
            strategy_used=strategyUsed,
            my_note=myNote,
        )

    def deleteMemo(self, ID):
        target = stock_memo.objects.get(id=ID)
        target.delete()
