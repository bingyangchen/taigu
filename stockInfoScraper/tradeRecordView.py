from .utils import getCompanyName
from .models import trade_record, company
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from .my_decorators import cors_exempt


@csrf_exempt
@cors_exempt
def tradeCRUD(request):
    if request.method == "POST":
        s = TradeRecordView()
        mode = request.POST.get("mode")
        ID = request.POST.get("id")
        dealTime = request.POST.get("deal-time")
        sid = request.POST.get("sid")
        dealPrice = request.POST.get("deal-price")
        dealQuantity = request.POST.get("deal-quantity")
        handlingFee = request.POST.get("handling-fee")
        if mode == "create":
            if (
                dealTime == None
                or sid == None
                or dealPrice == None
                or dealQuantity == None
                or handlingFee == None
            ):
                result = {"error-message": "Data not sufficient."}
            else:
                s.createTradeLog(dealTime, sid, dealPrice, dealQuantity, handlingFee)
                result = {"success-message": "creation-success"}
        elif mode == "read":
            dealTimeList = request.POST.get("deal-time-list", default=[])
            dealTimeList = (
                dealTimeList.split(",") if len(dealTimeList) > 0 else dealTimeList
            )
            sidList = request.POST.get("sid-list", default=[])
            sidList = sidList.split(",") if len(sidList) > 0 else sidList
            result = {"data": s.readTradeLog(dealTimeList, sidList)}
        elif mode == "update":
            if (
                ID == None
                or dealTime == None
                or sid == None
                or dealPrice == None
                or dealQuantity == None
                or handlingFee == None
            ):
                result = {"error-message": "Data not sufficient."}
            else:
                s.updateTradeLog(
                    ID, dealTime, sid, dealPrice, dealQuantity, handlingFee
                )
                result = {"success-message": "update-success"}
        elif mode == "delete":
            if ID == None:
                result = {"error-message": "Data not sufficient."}
            else:
                s.deleteTradeLog(ID)
                result = {"success-message": "deletion-success"}
        else:
            result = {"error-message": "Mode Not Exsist"}
    else:
        result = {"error-message": "Only POST methods are available."}
    response = JsonResponse(result)
    return response


class TradeRecordView:
    def __init__(self):
        pass

    def createTradeLog(self, dealTime, sid, dealPrice, dealQuantity, handlingFee):
        c, created = company.objects.get_or_create(
            stock_id=sid, defaults={"name": getCompanyName(sid)}
        )
        tr = trade_record.objects.create(
            company=c,
            deal_time=int(dealTime),
            deal_price=float(dealPrice),
            deal_quantity=int(dealQuantity),
            handling_fee=int(handlingFee),
        )

    def readTradeLog(self, dealTimeList, sidList):
        if dealTimeList != [] or sidList != []:
            if dealTimeList != [] and sidList != []:
                result = trade_record.objects.filter(deal_time__in=dealTimeList).filter(
                    company__stock_id__in=sidList
                )
            elif dealTimeList == []:
                result = trade_record.objects.filter(company__stock_id__in=sidList)
            else:
                result = trade_record.objects.filter(deal_time__in=dealTimeList)
        else:
            result = trade_record.objects.all()
        result = result.order_by("deal_time", "id").reverse()
        dictResultList = []
        for each in result:
            dictResultList.append(
                {
                    "id": each.id,
                    "deal-time": each.deal_time,
                    "sid": each.company.stock_id,
                    "company-name": each.company.name,
                    "deal-price": each.deal_price,
                    "deal-quantity": each.deal_quantity,
                    "handling-fee": each.handling_fee,
                }
            )
        return dictResultList

    def updateTradeLog(self, ID, dealTime, sid, dealPrice, dealQuantity, handlingFee):
        c, created = company.objects.get_or_create(
            stock_id=sid, defaults={"name": getCompanyName(sid)}
        )
        trade_record.objects.filter(id=ID).update(
            company=c,
            deal_time=int(dealTime),
            deal_price=float(dealPrice),
            deal_quantity=int(dealQuantity),
            handling_fee=int(handlingFee),
        )

    def deleteTradeLog(self, ID):
        target = trade_record.objects.get(id=ID)
        target.delete()
