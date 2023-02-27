import requests
from pyquery import PyQuery


class UnknownStockIdError(Exception):
    pass


def validate_stock_id(sid: str):
    if not get_company_name(sid):
        raise UnknownStockIdError("Unknown Stock ID")


def get_company_name(sid: str) -> str:
    res = requests.post(f"https://isin.twse.com.tw/isin/single_main.jsp?owncode={sid}")
    doc = PyQuery(res.text)
    name = doc.find("tr:nth-child(2)>td:nth-child(4)").text()
    return name or ""
