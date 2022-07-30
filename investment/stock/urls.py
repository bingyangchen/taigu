from django.urls import re_path
from . import (
    cashDividendRecordApis,
    memoApis,
    stockInfoApis,
    tradePlanApis,
    tradeRecordApis,
)

urlpatterns = [
    re_path(r"^info[/]?$", stockInfoApis.fetch),
    re_path(r"^trade[/]?$", tradeRecordApis.crud),
    re_path(r"^dividend[/]?$", cashDividendRecordApis.crud),
    re_path(r"^memo[/]?$", memoApis.crud),
    re_path(r"^plan[/]?$", tradePlanApis.crud),
]
