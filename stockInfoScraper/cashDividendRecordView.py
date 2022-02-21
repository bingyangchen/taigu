from requests import post
from pyquery import PyQuery
from .models import cash_dividend_record, company
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from .my_decorators import cors_exempt


@csrf_exempt
@cors_exempt
def dividendCRUD(request):
    if request.method == "POST":
        s = CashDividendRecordView()
        mode = request.POST.get("mode")
        ID = request.POST.get("id")
        dealTime = request.POST.get("deal-time")
        sid = request.POST.get("sid")
        cashDividend = request.POST.get("cash-dividend")
        if mode == "create":
            if dealTime == None or sid == None or cashDividend == None:
                result = {"error-message": "Data not sufficient."}
            else:
                s.createCashDividendLog(dealTime, sid, cashDividend)
                result = {"success-message": "creation-success"}
        elif mode == "read":
            dealTimeList = request.POST.get("deal-time-list", default=[])
            dealTimeList = (
                dealTimeList.split(",") if len(dealTimeList) > 0 else dealTimeList
            )
            sidList = request.POST.get("sid-list", default=[])
            sidList = sidList.split(",") if len(sidList) > 0 else sidList
            result = {"data": s.readCashDividendLog(dealTimeList, sidList)}
        elif mode == "update":
            if ID == None or dealTime == None or sid == None or cashDividend == None:
                result = {"error-message": "Data not sufficient."}
            else:
                s.updateCashDividendLog(ID, dealTime, sid, cashDividend)
                result = {"success-message": "update-success"}
        elif mode == "delete":
            if ID == None:
                result = {"error-message": "Data not sufficient."}
            else:
                s.deleteCashDividendLog(ID)
                result = {"success-message": "deletion-success"}
        else:
            result = {"error-message": "Mode Not Exist"}
    else:
        result = {"error-message": "Only POST methods are available."}
    response = JsonResponse(result)
    return response


class CashDividendRecordView:
    def __init__(self):
        pass

    def createCashDividendLog(self, dealTime, sid, cashDividend):
        c, created = company.objects.get_or_create(
            stock_id=sid, defaults={"name": self.getCompanyName(sid)}
        )
        cdr = cash_dividend_record.objects.create(
            company=c,
            deal_time=int(dealTime),
            cash_dividend=int(cashDividend),
        )

    def readCashDividendLog(self, dealTimeList, sidList):
        if dealTimeList != [] or sidList != []:
            if dealTimeList != [] and sidList != []:
                result = cash_dividend_record.objects.filter(
                    deal_time__in=dealTimeList
                ).filter(company__stock_id__in=sidList)
            elif dealTimeList == []:
                result = cash_dividend_record.objects.filter(
                    company__stock_id__in=sidList
                )
            else:
                result = cash_dividend_record.objects.filter(deal_time__in=dealTimeList)
        else:
            result = cash_dividend_record.objects.all()
        result = result.order_by("deal_time").reverse()
        dictResultList = []
        for each in result:
            dictResultList.append(
                {
                    "id": each.id,
                    "deal-time": each.deal_time,
                    "sid": each.company.stock_id,
                    "company-name": each.company.name,
                    "cash-dividend": each.cash_dividend,
                }
            )
        return dictResultList

    def updateCashDividendLog(self, ID, dealTime, sid, cashDividend):
        c, created = company.objects.get_or_create(
            stock_id=sid, defaults={"name": self.getCompanyName(sid)}
        )
        cash_dividend_record.objects.filter(id=ID).update(
            company=c,
            deal_time=int(dealTime),
            cash_dividend=int(cashDividend),
        )

    def deleteCashDividendLog(self, ID):
        target = cash_dividend_record.objects.get(id=ID)
        target.delete()

    def getCompanyName(self, sid):
        res = post("https://isin.twse.com.tw/isin/single_main.jsp?owncode=%s" % sid)
        doc = PyQuery(res.text)
        returnedCompanyName = doc.find("tr:nth-child(2)>td:nth-child(4)").text()
        return returnedCompanyName
