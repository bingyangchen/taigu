import datetime
from requests import get
import json
from pyquery import PyQuery
import pytz

from django.db.models import Sum
from django.views.decorators.csrf import csrf_exempt
from django.http import JsonResponse
from django.views.decorators.http import require_GET

from .models import company, stock_info, trade_record
from .my_decorators import cors_exempt


@csrf_exempt
@cors_exempt
@require_GET
def fetchStockInfo(request):
    s = StockInfoView()
    date = request.GET.get("date")
    sidList = request.GET.get("sid-list", default=[])
    sidList = sidList.split(",") if len(sidList) > 0 else sidList
    try:
        if date != None:
            s.stocksSingleDay(date=date, sidList=sidList)
        else:
            s.stocksSingleDay(sidList=sidList)
        result = {"data": s.result}
    except Exception as e:
        result = {"Error Message from views": str(e)}
    response = JsonResponse(result)
    return response


class StockInfoView:
    def __init__(self):
        # info of multiple stocks, single day
        # self.endPoint1 = "https://www.twse.com.tw/exchangeReport/MI_INDEX"
        self.endPoint = "https://mis.twse.com.tw/stock/api/getStockInfo.jsp?ex_ch="

        # info of single stock, multiple days
        # self.endPoint2 = "https://www.twse.com.tw/exchangeReport/STOCK_DAY?response=json&date=20210809&stockNo=2330"
        self.result = []

    def fetchAndStore(self, sidList, date):
        if sidList == []:
            return
        try:
            allData = []
            res = []
            queryStr = ""
            for each in sidList:
                queryStr += "tse_" + each + ".tw|"
                queryStr += "otc_" + each + ".tw|"
            try:
                res = get(self.endPoint + queryStr)
                res = json.loads(PyQuery(res.text).text())["msgArray"]
            except:
                print("failed to fetch")
                return

            # arrange the data format
            for each in res:
                dataRow = {}
                try:
                    c, created = company.objects.update_or_create(
                        stock_id=each["ch"].split(".")[0], defaults={"name": each["n"]}
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

            # store
            for each in allData:
                stock_info.objects.update_or_create(
                    company=each["company"], defaults=each
                )

            # prepare result
            q = stock_info.objects.filter(company__stock_id__in=sidList)
            for each in q:
                self.result.append(
                    {
                        "date": each.date,
                        "sid": each.company.stock_id,
                        "name": each.company.name,
                        "trade-type": each.trade_type,
                        "quantity": each.quantity,
                        "open": each.open_price,
                        "close": each.close_price,
                        "highest": each.highest_price,
                        "lowest": each.lowest_price,
                        "fluct-price": each.fluct_price,
                        "fluct-rate": each.fluct_rate,
                    }
                )
        except Exception as e:
            raise e

    def stocksSingleDay(
        self,
        date=(datetime.datetime.now(pytz.utc) + datetime.timedelta(hours=8)).strftime(
            "%Y%m%d"
        ),
        sidList=[],
    ):
        currentHour = int(
            (datetime.datetime.now(pytz.utc) + datetime.timedelta(hours=8)).strftime(
                "%H"
            )
        )
        if currentHour < 14:
            date = datetime.datetime.strptime(date, "%Y%m%d") - datetime.timedelta(
                days=1
            )
            date = date.strftime("%Y%m%d")
        date = int(date)

        if sidList == []:
            # SELECT sid from trade_record GROUP BY sid HAVING SUM(deal_quantity) > 0
            autoSidQuery = (
                trade_record.objects.values("company__stock_id")
                .annotate(sum=Sum("deal_quantity"))
                .filter(sum__gt=0)
                .values("company__stock_id")
            )
            for each in autoSidQuery:
                sidList.append(each["company__stock_id"])

        try:
            needToFetchSidList = []
            for eachSid in sidList:
                q = stock_info.objects.filter(company__stock_id=eachSid)
                if len(q) == 1:
                    q = q.get()
                    if (
                        int(q.date) != date
                        or not q.company.stock_id
                        or not q.company.name
                        or not q.trade_type
                    ):
                        needToFetchSidList.append(eachSid)
                    else:
                        self.result.append(
                            {
                                "date": q.date,
                                "sid": q.company.stock_id,
                                "name": q.company.name,
                                "trade-type": q.trade_type,
                                "quantity": q.quantity,
                                "open": q.open_price,
                                "close": q.close_price,
                                "highest": q.highest_price,
                                "lowest": q.lowest_price,
                                "fluct-price": q.fluct_price,
                                "fluct-rate": q.fluct_rate,
                            }
                        )
                else:
                    needToFetchSidList.append(eachSid)
            self.fetchAndStore(needToFetchSidList, date)
        except Exception as e:
            raise e
