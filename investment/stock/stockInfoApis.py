import datetime
import requests
import json
from pyquery import PyQuery
import pytz

from django.http import JsonResponse, HttpRequest
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_GET

from .models import Company, StockInfo
from investment.account.models import User
from ..decorators import require_login


@csrf_exempt
@require_GET
@require_login
def info(request: HttpRequest):
    helper = Helper()

    date = request.GET.get("date")
    sidList = request.GET.get("sid-list", [])
    sidList = sidList.split(",") if len(sidList) > 0 else sidList

    res = {"success": False, "data": []}
    try:
        if date:
            helper.stocksSingleDay(
                user=request.user,
                date=datetime.datetime.strptime(date, "%Y-%m-%d").date(),
                sidList=sidList,
            )
        else:
            helper.stocksSingleDay(user=request.user, sidList=sidList)
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
        user: User,
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

        companies = (
            Company.objects.all()
            if sidList == []
            else Company.objects.filter(pk__in=sidList)
        )

        # SELECT sid from trade_record GROUP BY sid HAVING SUM(deal_quantity) > 0
        # autoSidQuery = (
        #     trade_record.objects.values("company__pk")
        #     .annotate(sum=Sum("deal_quantity"))
        #     .filter(sum__gt=0)
        #     .values("company__pk")
        # )

        needToFetchSidList = []
        for c in companies:
            if si := c.stock_info:
                if si.date != date:
                    needToFetchSidList.append(c.pk)
                else:
                    self.result.append(
                        {
                            "date": si.date,
                            "sid": c.pk,
                            "name": c.name,
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
                needToFetchSidList.append(c.pk)

        if len(needToFetchSidList) > 0:
            self.fetchAndStore(needToFetchSidList, date)

    def fetchAndStore(self, sidList, date: datetime.date):
        if len(sidList) == 0:
            return

        allData = []

        # 70 sids per request
        sidsToSolved = sidList[:70]
        queryString = ""
        for sid in sidsToSolved:
            queryString += f"tse_{sid}.tw|otc_{sid}.tw|"

        res = requests.get(self.endPoint + queryString)
        res = json.loads(PyQuery(res.text).text())["msgArray"] or []

        # Arrange the data fetched
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
        for each in StockInfo.objects.filter(company__pk__in=sidsToSolved):
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
