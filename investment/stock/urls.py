from django.urls import path
from . import (
    cashDividendRecordApis,
    memoApis,
    stockInfoApis,
    tradePlanApis,
    tradeRecordApis,
)

urlpatterns = [
    path("info", stockInfoApis.fetch),
    path("trade", tradeRecordApis.crud),
    path("dividend", cashDividendRecordApis.crud),
    path("memo", memoApis.crud),
    path("plan", tradePlanApis.crud),
]
