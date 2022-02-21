from requests import post
from pyquery import PyQuery


def getCompanyName(sid):
    res = post("https://isin.twse.com.tw/isin/single_main.jsp?owncode=%s" % sid)
    doc = PyQuery(res.text)
    returnedCompanyName = doc.find("tr:nth-child(2)>td:nth-child(4)").text()
    return returnedCompanyName
