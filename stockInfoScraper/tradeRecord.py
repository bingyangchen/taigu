from requests import post
from pyquery import PyQuery as pq
from .models import TradeRecord


class TradeRecordView:
    def __init__(self):
        pass

    def createTradeLog(self, dealTime, sid, dealPrice, dealQuantity, handlingFee):
        tr = TradeRecord(dealTime=int(dealTime),
                         sid=sid,
                         companyName=self.getCompanyName(sid),
                         dealPrice=float(dealPrice),
                         dealQuantity=int(dealQuantity),
                         handlingFee=int(handlingFee))
        tr.save()

    def readTradeLog(self, dealTimeList, sidList):
        result = TradeRecord.objects.all()    # Default: all dealTimes, all sids
        if dealTimeList != [] or sidList != []:    # specific dealTimes, specific sids
            if dealTimeList != [] and sidList != []:
                result = TradeRecord.objects.filter(
                    dealTime__in=dealTimeList).filter(sid__in=sidList)
            elif dealTimeList == []:
                result = TradeRecord.objects.filter(sid__in=sidList)
            else:
                result = TradeRecord.objects.filter(dealTime__in=dealTimeList)
        result = result.order_by("dealTime", "id").reverse()
        dictResultList = []
        for each in result:
            dictResultList.append({
                "id": each.id,
                "deal-time": each.dealTime,
                "sid": each.sid,
                "company-name": each.companyName,
                "deal-price": each.dealPrice,
                "deal-quantity": each.dealQuantity,
                "handling-fee": each.handlingFee
            })
        return dictResultList

    def updateTradeLog(self, ID, dealTime, sid, dealPrice, dealQuantity, handlingFee):
        target = TradeRecord.objects.get(id=ID)
        target.dealTime = int(dealTime)
        target.sid = sid
        target.companyName = self.getCompanyName(sid)
        target.dealPrice = float(dealPrice)
        target.dealQuantity = int(dealQuantity)
        target.handlingFee = int(handlingFee)
        target.save()

    def deleteTradeLog(self, ID):
        target = TradeRecord.objects.get(id=ID)
        target.delete()

    def getCompanyName(self, sid):
        res = post(
            "https://isin.twse.com.tw/isin/single_main.jsp?owncode=%s" % sid)
        doc = pq(res.text)
        returnedCompanyName = doc.find(
            "tr:nth-child(2)>td:nth-child(4)").text()
        return returnedCompanyName
