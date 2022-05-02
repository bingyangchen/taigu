from requests import post, get
import json
import time

USER_ID = "ec8315d2-5bc1-49de-9501-5b485e8d2579"


def create_cash_dividend_record():
    data = []
    with open("./db_backups/local_db_to_json/cash_dividend.json", "r") as fObj:
        data = json.loads(fObj.read())
    for each in data:
        dealTime = str(each["deal-time"])
        dealTime = dealTime[:4] + "-" + dealTime[4:6] + "-" + dealTime[6:]
        # post(
        #     url="http://127.0.0.1:8000/api/stock/create-dividend",
        #     data={
        #         "uid": USER_ID,
        #         "deal-time": dealTime,
        #         "sid": each["sid"],
        #         "cash-dividend": each["cash-dividend"],
        #     },
        # )
        print(dealTime)
        time.sleep(0.1)


def create_trade_record():
    data = []
    with open("./db_backups/local_db_to_json/trade_record.json", "r") as fObj:
        data = json.loads(fObj.read())
    for each in data:
        dealTime = str(each["deal-time"])
        dealTime = dealTime[:4] + "-" + dealTime[4:6] + "-" + dealTime[6:]
        post(
            url="http://127.0.0.1:8000/api/stock/create-trade",
            data={
                "uid": USER_ID,
                "deal-time": dealTime,
                "sid": each["sid"],
                "deal-price": each["deal-price"],
                "deal-quantity": each["deal-quantity"],
                "handling-fee": each["handling-fee"],
            },
        )
        print(dealTime)
        time.sleep(0.1)


def create_memo():
    data = []
    with open("./db_backups/local_db_to_json/stock_memo.json", "r") as fObj:
        data = json.loads(fObj.read())
    for each in data:
        post(
            url="http://127.0.0.1:8000/api/stock/create-memo",
            data={
                "uid": USER_ID,
                "sid": each["sid"],
                "business": each["main-goods-or-services"],
                "strategy": each["strategy-used"],
                "note": each["my-note"],
            },
        )
        print(each["main-goods-or-services"])
        time.sleep(0.1)


def create_plan():
    data = []
    with open("./db_backups/local_db_to_json/trade_plan.json", "r") as fObj:
        data = json.loads(fObj.read())
    for each in data:
        post(
            url="http://127.0.0.1:8000/api/stock/create-plan",
            data={
                "uid": USER_ID,
                "sid": each["sid"],
                "plan-type": each["plan-type"],
                "target-price": each["target-price"],
                "target-quantity": each["target-quantity"],
            },
        )
        print(each["sid"])
        time.sleep(0.1)


create_plan()
