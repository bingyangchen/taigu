import datetime
from requests import get
import json
from pyquery import PyQuery
import pytz

from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_GET

from .models import Company, StockInfo
from ..decorators import require_login


@csrf_exempt
@require_GET
@require_login
def fetch(request):
    helper = Helper()

    date = request.GET.get("date")
    sidList = request.GET.get("sid-list", [])
    sidList = sidList.split(",") if len(sidList) > 0 else sidList

    res = {"success": False, "data": []}
    try:
        if date:
            helper.stocksSingleDay(
                date=datetime.datetime.strptime(date, "%Y-%m-%d").date(),
                sidList=sidList,
            )
        else:
            helper.stocksSingleDay(sidList=sidList)
        res["data"] = helper.result
        res["success"] = True
    except Exception as e:
        res["error"] = str(e)
    return JsonResponse(res)


class Helper:
    def __init__(self):
        # info of multiple stocks, single day
        # self.endPoint1 = "https://www.twse.com.tw/exchangeReport/MI_INDEX"
        self.endPoint = "https://mis.twse.com.tw/stock/api/getStockInfo.jsp?ex_ch="

        # info of single stock, multiple days (OTC stocks is not available)
        # self.endPoint2 = "https://www.twse.com.tw/exchangeReport/STOCK_DAY?response=json&date=20210809&stockNo=2330"
        self.result = []

    def stocksSingleDay(
        self,
        date: datetime.date = (
            datetime.datetime.now(pytz.utc) + datetime.timedelta(hours=8)
        ).date(),
        sidList=[],
    ):
        currentHour = int(
            (datetime.datetime.now(pytz.utc) + datetime.timedelta(hours=8)).strftime(
                "%H"
            )
        )
        if currentHour < 14:
            date -= datetime.timedelta(days=1)

        if sidList == []:
            # SELECT sid from trade_record GROUP BY sid HAVING SUM(deal_quantity) > 0
            # autoSidQuery = (
            #     trade_record.objects.values("company__pk")
            #     .annotate(sum=Sum("deal_quantity"))
            #     .filter(sum__gt=0)
            #     .values("company__pk")
            # )
            for c in Company.objects.all():
                sidList.append(c.pk)

        needToFetchSidList = []
        for eachSid in sidList:
            si = StockInfo.objects.filter(company__pk=eachSid).first()
            if si:
                if si.date != date or not si.company.name or not si.trade_type:
                    needToFetchSidList.append(eachSid)
                else:
                    self.result.append(
                        {
                            "date": si.date,
                            "sid": si.company.pk,
                            "name": si.company.name,
                            "trade_type": si.trade_type,
                            "quantity": si.quantity,
                            "open": si.open_price,
                            "close": si.close_price,
                            "highest": si.highest_price,
                            "lowest": si.lowest_price,
                            "fluct_price": si.fluct_price,
                            "fluct_rate": si.fluct_rate,
                        }
                    )
            else:
                needToFetchSidList.append(eachSid)
        self.fetchAndStore(needToFetchSidList, date)

    def fetchAndStore(self, sidList, date: datetime.date):
        if len(sidList) == 0:
            return
        allData = []
        queryStr = ""

        # 70 sid per request
        for each in sidList[:70]:
            queryStr += "tse_" + each + ".tw|"
            queryStr += "otc_" + each + ".tw|"
        res = get(self.endPoint + queryStr)
        res = json.loads(PyQuery(res.text).text())["msgArray"] or []

        # arrange the data format
        for each in res:
            dataRow = {}
            try:
                c, created = Company.objects.update_or_create(
                    pk=each["ch"].split(".")[0], defaults={"name": each["n"]}
                )
                dataRow["company"] = c
                dataRow["date"] = date
                dataRow["trade_type"] = each["ex"]
                dataRow["quantity"] = each["v"]
                dataRow["open_price"] = str(round(float(each["o"]), 2))
                try:  # 收漲停時，z 會是 "-"，所以改看最高價
                    dataRow["close_price"] = str(round(float(each["z"]), 2))
                except:
                    dataRow["close_price"] = str(round(float(each["h"]), 2))
                dataRow["highest_price"] = str(round(float(each["h"]), 2))
                dataRow["lowest_price"] = str(round(float(each["l"]), 2))
                dataRow["fluct_price"] = str(
                    round((float(dataRow["close_price"]) - float(each["y"])), 2)
                )
                dataRow["fluct_rate"] = str(
                    round(
                        (float(dataRow["close_price"]) - float(each["y"]))
                        / float(each["y"]),
                        4,
                    )
                )
            except:
                continue
            allData.append(dataRow)

        # store into database
        for each in allData:
            StockInfo.objects.update_or_create(company=each["company"], defaults=each)

        # prepare result
        for each in StockInfo.objects.filter(company__pk__in=sidList[:70]):
            self.result.append(
                {
                    "date": each.date,
                    "sid": each.company.pk,
                    "name": each.company.name,
                    "trade_type": each.trade_type,
                    "quantity": each.quantity,
                    "open": each.open_price,
                    "close": each.close_price,
                    "highest": each.highest_price,
                    "lowest": each.lowest_price,
                    "fluct_price": each.fluct_price,
                    "fluct_rate": each.fluct_rate,
                }
            )

        # Process the rest sids
        self.fetchAndStore(sidList[70:], date)
