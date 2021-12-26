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
        date = str(request.GET.get("date")) if request.GET.get(
            "date") != None else None
        sidList = str(request.GET.get("sid-list")).split(
            ",") if request.GET.get("sid-list") != None else []
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
        mode = str(request.POST.get("mode"))
        ID = str(request.POST.get("id"))
        dealTime = str(request.POST.get("deal-time"))
        sid = str(request.POST.get("sid"))
        dealPrice = str(request.POST.get("deal-price"))
        dealQuantity = str(request.POST.get("deal-quantity"))
        handlingFee = str(request.POST.get("handling-fee"))
        result = None
        if mode == "create":
            if dealTime == "" or sid == "" or dealPrice == "" or dealQuantity == "" or handlingFee == "":
                result = {"error-message": "Data not sufficient."}
            else:
                s.createTradeLog(dealTime, sid, dealPrice,
                                 dealQuantity, handlingFee)
                result = {"success-message": "creation-success"}
        elif mode == "read":
            dealTimeList = str(request.POST.get("deal-time-list")).split(
                ",") if request.POST.get("deal-time-list") != None else []
            sidList = str(request.POST.get("sid-list")).split(
                ",") if request.POST.get("sid-list") != None else []
            result = {"data": s.readTradeLog(dealTimeList, sidList)}
        elif mode == "update":
            if ID == "" or dealTime == "" or sid == "" or dealPrice == "" or dealQuantity == "" or handlingFee == "":
                result = {"error-message": "Data not sufficient."}
            else:
                s.updateTradeLog(ID, dealTime, sid, dealPrice,
                                 dealQuantity, handlingFee)
                result = {"success-message": "update-success"}
        elif mode == "delete":
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
        mode = str(request.POST.get("mode"))
        ID = str(request.POST.get("id"))
        dealTime = str(request.POST.get("deal-time"))
        sid = str(request.POST.get("sid"))
        cashDividend = str(request.POST.get("cash-dividend"))
        result = None
        if mode == "create":
            if dealTime == "" or sid == "" or cashDividend == "":
                result = {"error-message": "Data not sufficient."}
            else:
                s.createCashDividendLog(dealTime, sid, cashDividend)
                result = {"success-message": "creation-success"}
        elif mode == "read":
            dealTimeList = str(request.POST.get("deal-time-list")).split(
                ",") if request.POST.get("deal-time-list") != None else []
            sidList = str(request.POST.get("sid-list")).split(
                ",") if request.POST.get("sid-list") != None else []
            result = {"data": s.readCashDividendLog(dealTimeList, sidList)}
        elif mode == "update":
            if ID == "" or dealTime == "" or sid == "" or cashDividend == "":
                result = {"error-message": "Data not sufficient."}
            else:
                s.updateCashDividendLog(ID, dealTime, sid, cashDividend)
                result = {"success-message": "update-success"}
        elif mode == "delete":
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
        mode = str(request.POST.get("mode"))
        ID = str(request.POST.get("id"))
        sid = str(request.POST.get("sid"))
        mainGoodsOrServices = str(request.POST.get("main-goods-or-services"))
        strategyUsed = str(request.POST.get("strategy-used"))
        myNote = str(request.POST.get("my-note"))
        result = None
        if mode == "create":
            if sid == "":
                result = {"error-message": "Data not sufficient."}
            else:
                s.createMemo(sid, mainGoodsOrServices, strategyUsed, myNote)
                result = {"success-message": "creation-success"}
        elif mode == "read":
            sidList = str(request.POST.get("sid-list")).split(
                ",") if request.POST.get("sid-list") != None else []
            result = {"data": s.readMemo(sidList)}
        elif mode == "update":
            if ID == "":
                result = {"error-message": "Data not sufficient."}
            else:
                s.updateMemo(ID, mainGoodsOrServices, strategyUsed, myNote)
                result = {"success-message": "update-success"}
        elif mode == "delete":
            if ID == "":
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
        mode = str(request.POST.get("mode"))
        ID = str(request.POST.get("id"))
        sid = str(request.POST.get("sid"))
        planType = str(request.POST.get("plan-type"))
        targetPrice = str(request.POST.get("target-price"))
        targetQuantity = str(request.POST.get("target-quantity"))
        result = None
        if mode == "create":
            if sid == "":
                result = {"error-message": "Data not sufficient."}
            else:
                s.createPlan(sid, planType, targetPrice, targetQuantity)
                result = {"success-message": "creation-success"}
        elif mode == "read":
            sidList = str(request.POST.get("sid-list")).split(
                ",") if request.POST.get("sid-list") != None else []
            result = {"data": s.readPlan(sidList)}
        elif mode == "update":
            if ID == "":
                result = {"error-message": "Data not sufficient."}
            else:
                s.updatePlan(ID, planType, targetPrice, targetQuantity)
                result = {"success-message": "update-success"}
        elif mode == "delete":
            if ID == "":
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
