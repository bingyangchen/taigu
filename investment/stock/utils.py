import requests
from pyquery import PyQuery


class UnknownStockIdError(Exception):
    pass


def validateStockId(sid: str):
    if not getCompanyName(sid):
        raise UnknownStockIdError("Unknown Stock ID")


def getCompanyName(sid: str) -> str:
    res = requests.post(f"https://isin.twse.com.tw/isin/single_main.jsp?owncode={sid}")
    doc = PyQuery(res.text)
    returnedCompanyName = doc.find("tr:nth-child(2)>td:nth-child(4)").text()
    return returnedCompanyName or ""
