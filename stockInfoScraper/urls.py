from django.urls import path
from . import (
    stockInfoView,
    tradeRecordView,
    cashDividendRecordView,
    stockMemoView,
    tradePlanView,
)

urlpatterns = [
    path("fetch-stock-info", stockInfoView.fetchStockInfo),
    path("trade", tradeRecordView.tradeCRUD),
    path("dividend", cashDividendRecordView.dividendCRUD),
    path("memo", stockMemoView.memoCRUD),
    path("plan", tradePlanView.planCRUD),
]
