import datetime
import requests
import json
from pyquery import PyQuery
import pytz

from django.http import JsonResponse, HttpRequest
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_GET

from investment.account.models import User
from ..models import Company, StockInfo
from ...decorators import require_login


@csrf_exempt
@require_GET
@require_login
def info(request: HttpRequest):
    helper = Helper()

    sid_list = request.GET.get("sid-list", [])
    sid_list = sid_list.split(",") if len(sid_list) > 0 else sid_list

    res = {"success": False, "data": []}
    try:
        if date := request.GET.get("date"):
            helper.get_info(
                user=request.user,
                date=datetime.datetime.strptime(date, "%Y-%m-%d").date(),
                sid_list=sid_list,
            )
        else:
            helper.get_info(user=request.user, sid_list=sid_list)
        res["data"] = helper.result
        res["success"] = True
    except Exception as e:
        res["error"] = str(e)
    return JsonResponse(res)


class Helper:
    def __init__(self):
        # info of multiple stocks, single day
        # self.endPoint1 = "https://www.twse.com.tw/exchangeReport/MI_INDEX"
        self.endpoint = "https://mis.twse.com.tw/stock/api/getStockInfo.jsp?ex_ch="

        # info of single stock, multiple days (OTC stocks is not available)
        # self.endPoint2 = "https://www.twse.com.tw/exchangeReport/STOCK_DAY?response=json&date=20210809&stockNo=2330"
        self.result = []

    def get_info(
        self,
        user: User,
        date: datetime.date = (
            datetime.datetime.now(pytz.utc) + datetime.timedelta(hours=8)
        ).date(),
        sid_list=[],
    ):
        current_hour = int(
            (datetime.datetime.now(pytz.utc) + datetime.timedelta(hours=8)).strftime(
                "%H"
            )
        )
        if current_hour < 14:
            date -= datetime.timedelta(days=1)

        companies = (
            Company.objects.all()
            if sid_list == []
            else Company.objects.filter(pk__in=sid_list)
        )

        # SELECT sid from trade_record GROUP BY sid HAVING SUM(deal_quantity) > 0
        # autoSidQuery = (
        #     trade_record.objects.values("company__pk")
        #     .annotate(sum=Sum("deal_quantity"))
        #     .filter(sum__gt=0)
        #     .values("company__pk")
        # )

        sid_list_need_fetching = []
        for c in companies:
            if si := StockInfo.objects.filter(company__pk=c.pk).first():
                if si.date != date:
                    sid_list_need_fetching.append(c.pk)
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
                sid_list_need_fetching.append(c.pk)

        if len(sid_list_need_fetching) > 0:
            self.fetch_and_store(sid_list_need_fetching, date)

    def fetch_and_store(self, sid_list, date: datetime.date):
        if len(sid_list) == 0:
            return

        all_data = []

        # 70 sids per request
        sids_to_solved = sid_list[:70]
        query_string = ""
        for sid in sids_to_solved:
            query_string += f"tse_{sid}.tw|otc_{sid}.tw|"

        res = requests.get(self.endpoint + query_string)
        res = json.loads(PyQuery(res.text).text())["msgArray"] or []

        # Arrange the data fetched
        for each in res:
            row = {}
            try:
                c, created = Company.objects.update_or_create(
                    pk=each["ch"].split(".")[0], defaults={"name": each["n"]}
                )
                row["company"] = c
                row["date"] = date
                row["trade_type"] = each["ex"]
                row["quantity"] = each["v"]
                row["open_price"] = str(round(float(each["o"]), 2))
                try:  # 收漲停時，z 會是 "-"，所以改看最高價
                    row["close_price"] = str(round(float(each["z"]), 2))
                except:
                    row["close_price"] = str(round(float(each["h"]), 2))
                row["highest_price"] = str(round(float(each["h"]), 2))
                row["lowest_price"] = str(round(float(each["l"]), 2))
                row["fluct_price"] = str(
                    round((float(row["close_price"]) - float(each["y"])), 2)
                )
                row["fluct_rate"] = str(
                    round(
                        (float(row["close_price"]) - float(each["y"]))
                        / float(each["y"]),
                        4,
                    )
                )
            except:
                continue
            all_data.append(row)

        # Store to database
        for each in all_data:
            StockInfo.objects.update_or_create(company=each["company"], defaults=each)

        # Prepare the result
        for each in StockInfo.objects.filter(company__pk__in=sids_to_solved):
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
        self.fetch_and_store(sid_list[70:], date)
