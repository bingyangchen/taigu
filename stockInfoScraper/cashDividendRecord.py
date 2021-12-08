from requests import post
from pyquery import PyQuery as pq
from .models import CashDividendRecord


class CashDividendRecordView:
    def __init__(self):
        pass

    def createCashDividendLog(self, dealTime, sid, cashDividend):
        tr = CashDividendRecord(dealTime=int(dealTime),
                                sid=sid,
                                companyName=self.getCompanyName(sid),
                                cashDividend=int(cashDividend))
        tr.save()

    def readCashDividendLog(self, dealTimeList, sidList):
        result = CashDividendRecord.objects.all()    # Default: all dealTimes, all sids
        if dealTimeList != [] or sidList != []:    # specific dealTimes, specific sids
            if dealTimeList != [] and sidList != []:
                result = CashDividendRecord.objects.filter(
                    dealTime=dealTimeList[0]).filter(sid=sidList[0])
            elif dealTimeList == []:
                result = CashDividendRecord.objects.filter(sid=sidList[0])
            else:
                result = CashDividendRecord.objects.filter(
                    dealTime=dealTimeList[0])
            for each in dealTimeList:
                result.union(CashDividendRecord.objects.filter(dealTime=each))
            for each in sidList:
                result.union(CashDividendRecord.objects.filter(sid=each))
        result = result.order_by("dealTime").reverse()
        dictResultList = []
        for each in result:
            dictResultList.append({
                "id": each.id,
                "deal-time": each.dealTime,
                "sid": each.sid,
                "company-name": each.companyName,
                "cash-dividend": each.cashDividend
            })
        return dictResultList

    def updateCashDividendLog(self, ID, dealTime, sid, cashDividend):
        target = CashDividendRecord.objects.get(id=ID)
        target.dealTime = int(dealTime)
        target.sid = sid
        target.companyName = self.getCompanyName(sid)
        target.cashDividend = int(cashDividend)
        target.save()

    def deleteCashDividendLog(self, ID):
        target = CashDividendRecord.objects.get(id=ID)
        target.delete()

    def getCompanyName(self, sid):
        res = post(
            "https://isin.twse.com.tw/isin/single_main.jsp?owncode=%s" % sid)
        doc = pq(res.text)
        returnedCompanyName = doc.find(
            "tr:nth-child(2)>td:nth-child(4)").text()
        return returnedCompanyName
