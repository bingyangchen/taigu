from requests import post, get
import json


def dump_cash_dividend_record():
    data = post(
        url="http://127.0.0.1:8000/api/stock/dividend", data={"mode": "read"}
    ).json()["data"]

    for each in data:
        del each["id"]

    with open("./db_backups/local_db_to_json/cash_dividend.json", "w") as fObj:
        fObj.write(json.dumps(data, indent=4))


def dump_trade_record():
    data = post(
        url="http://127.0.0.1:8000/api/stock/trade", data={"mode": "read"}
    ).json()["data"]

    for each in data:
        del each["id"]

    with open("./db_backups/local_db_to_json/trade_record.json", "w") as fObj:
        fObj.write(json.dumps(data, indent=4))


def dump_stock_info():
    data = get(url="http://127.0.0.1:8000/api/stock/info").json()["data"]

    with open("./db_backups/local_db_to_json/stock_info.json", "w") as fObj:
        fObj.write(json.dumps(data, indent=4))


def dump_stock_memo():
    data = post(
        url="http://127.0.0.1:8000/api/stock/memo", data={"mode": "read"}
    ).json()["data"]

    for each in data:
        del each["id"]

    with open("./db_backups/local_db_to_json/stock_memo.json", "w") as fObj:
        fObj.write(json.dumps(data, indent=4))


def dump_trade_plan():
    data = post(
        url="http://127.0.0.1:8000/api/stock/plan", data={"mode": "read"}
    ).json()["data"]

    for each in data:
        del each["id"]

    with open("./db_backups/local_db_to_json/trade_plan.json", "w") as fObj:
        fObj.write(json.dumps(data, indent=4))


dump_trade_plan()
