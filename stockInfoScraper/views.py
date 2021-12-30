# from django.shortcuts import render
# from django.http.response import HttpResponse
from django.http import HttpResponse
from django.views.decorators.csrf import csrf_exempt
import json
from .stockInfo import StockInfoView
from .tradeRecord import TradeRecordView
from .cashDividendRecord import CashDividendRecordView
from .stockMemo import StockMemoView
from .tradePlan import TradePlanView


@csrf_exempt
def fetchStockInfo(request):
    if request.method == 'GET':
        s = StockInfoView()
        date = request.GET.get("date")
        sidList = request.GET.get("sid-list", default=[])
        sidList = sidList.split(",") if len(sidList) > 0 else sidList
        result = None
        try:
            if date != None:
                s.stocksSingleDay(date=date, sidList=sidList)
            else:
                s.stocksSingleDay(sidList=sidList)
            result = json.dumps({"data": s.result})
        except Exception as e:
            result = json.dumps({"Error Message from views": str(e)})
        response = HttpResponse(result)
        response["Access-Control-Allow-Origin"] = "*"
        return response


@csrf_exempt
def tradeCRUD(request):
    if request.method == "POST":
        s = TradeRecordView()
        mode = request.POST.get("mode")
        ID = request.POST.get("id")
        dealTime = request.POST.get("deal-time")
        sid = request.POST.get("sid")
        dealPrice = request.POST.get("deal-price")
        dealQuantity = request.POST.get("deal-quantity")
        handlingFee = request.POST.get("handling-fee")
        result = None
        if mode == "create":
            if dealTime == None or sid == None or dealPrice == None or dealQuantity == None or handlingFee == None:
                result = {"error-message": "Data not sufficient."}
            else:
                s.createTradeLog(dealTime, sid, dealPrice,
                                 dealQuantity, handlingFee)
                result = {"success-message": "creation-success"}
        elif mode == "read":
            dealTimeList = request.POST.get("deal-time-list", default=[])
            dealTimeList = dealTimeList.split(
                ",") if len(dealTimeList) > 0 else dealTimeList
            sidList = request.POST.get("sid-list", default=[])
            sidList = sidList.split(",") if len(sidList) > 0 else sidList
            result = {"data": s.readTradeLog(dealTimeList, sidList)}
        elif mode == "update":
            if ID == None or dealTime == None or sid == None or dealPrice == None or dealQuantity == None or handlingFee == None:
                result = {"error-message": "Data not sufficient."}
            else:
                s.updateTradeLog(ID, dealTime, sid, dealPrice,
                                 dealQuantity, handlingFee)
                result = {"success-message": "update-success"}
        elif mode == "delete":
            if ID == None:
                result = {"error-message": "Data not sufficient."}
            else:
                s.deleteTradeLog(ID)
                result = {"success-message": "deletion-success"}
        else:
            result = {"error-message": "Mode Not Exsist"}
    else:
        result = {"error-message": "Only POST methods are available."}
    result = json.dumps(result)
    response = HttpResponse(result)
    response["Access-Control-Allow-Origin"] = "*"
    return response


@csrf_exempt
def dividendCRUD(request):
    if request.method == "POST":
        s = CashDividendRecordView()
        mode = request.POST.get("mode")
        ID = request.POST.get("id")
        dealTime = request.POST.get("deal-time")
        sid = request.POST.get("sid")
        cashDividend = request.POST.get("cash-dividend")
        result = None
        if mode == "create":
            if dealTime == None or sid == None or cashDividend == None:
                result = {"error-message": "Data not sufficient."}
            else:
                s.createCashDividendLog(dealTime, sid, cashDividend)
                result = {"success-message": "creation-success"}
        elif mode == "read":
            dealTimeList = request.POST.get("deal-time-list", default=[])
            dealTimeList = dealTimeList.split(
                ",") if len(dealTimeList) > 0 else dealTimeList
            sidList = request.POST.get("sid-list", default=[])
            sidList = sidList.split(",") if len(sidList) > 0 else sidList
            result = {"data": s.readCashDividendLog(dealTimeList, sidList)}
        elif mode == "update":
            if ID == None or dealTime == None or sid == None or cashDividend == None:
                result = {"error-message": "Data not sufficient."}
            else:
                s.updateCashDividendLog(ID, dealTime, sid, cashDividend)
                result = {"success-message": "update-success"}
        elif mode == "delete":
            if ID == None:
                result = {"error-message": "Data not sufficient."}
            else:
                s.deleteCashDividendLog(ID)
                result = {"success-message": "deletion-success"}
        else:
            result = {"error-message": "Mode Not Exist"}
    else:
        result = {"error-message": "Only POST methods are available."}
    result = json.dumps(result)
    response = HttpResponse(result)
    response["Access-Control-Allow-Origin"] = "*"
    return response


@csrf_exempt
def memoCRUD(request):
    if request.method == "POST":
        s = StockMemoView()
        mode = request.POST.get("mode")
        ID = request.POST.get("id")
        sid = request.POST.get("sid")
        mainGoodsOrServices = request.POST.get("main-goods-or-services")
        strategyUsed = request.POST.get("strategy-used")
        myNote = request.POST.get("my-note")
        result = None
        if mode == "create":
            if sid == None:
                result = {"error-message": "Data not sufficient."}
            else:
                s.createMemo(sid, mainGoodsOrServices, strategyUsed, myNote)
                result = {"success-message": "creation-success"}
        elif mode == "read":
            sidList = request.POST.get("sid-list", default=[])
            sidList = sidList.split(",") if len(sidList) > 0 else sidList
            result = {"data": s.readMemo(sidList)}
        elif mode == "update":
            if ID == None:
                result = {"error-message": "Data not sufficient."}
            else:
                s.updateMemo(ID, mainGoodsOrServices, strategyUsed, myNote)
                result = {"success-message": "update-success"}
        elif mode == "delete":
            if ID == None:
                result = {"error-message": "Data not sufficient."}
            else:
                s.deleteMemo(ID)
                result = {"success-message": "deletion-success"}
        else:
            result = {"error-message": "Mode %s Not Exist" % mode}
    else:
        result = {"error-message": "Only POST methods are available."}
    result = json.dumps(result)
    response = HttpResponse(result)
    response["Access-Control-Allow-Origin"] = "*"
    return response


@csrf_exempt
def planCRUD(request):
    if request.method == "POST":
        s = TradePlanView()
        mode = request.POST.get("mode")
        ID = request.POST.get("id")
        sid = request.POST.get("sid")
        planType = request.POST.get("plan-type")
        targetPrice = request.POST.get("target-price")
        targetQuantity = request.POST.get("target-quantity")
        result = None
        if mode == "create":
            if sid == None:
                result = {"error-message": "Data not sufficient."}
            else:
                s.createPlan(sid, planType, targetPrice, targetQuantity)
                result = {"success-message": "creation-success"}
        elif mode == "read":
            sidList = request.POST.get("sid-list", default=[])
            sidList = sidList.split(",") if len(sidList) > 0 else sidList
            result = {"data": s.readPlan(sidList)}
        elif mode == "update":
            if ID == None:
                result = {"error-message": "Data not sufficient."}
            else:
                s.updatePlan(ID, planType, targetPrice, targetQuantity)
                result = {"success-message": "update-success"}
        elif mode == "delete":
            if ID == None:
                result = {"error-message": "Data not sufficient."}
            else:
                s.deletePlan(ID)
                result = {"success-message": "deletion-success"}
        else:
            result = {"error-message": "Mode %s Not Exist" % mode}
    else:
        result = {"error-message": "Only POST methods are available."}
    result = json.dumps(result)
    response = HttpResponse(result)
    response["Access-Control-Allow-Origin"] = "*"
    return response
