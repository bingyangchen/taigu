from django.urls import re_path
from . import cashDividendRecordApis, stockInfoApis, tradeRecordApis

urlpatterns = [
    re_path(r"^info[/]?$", stockInfoApis.info),
    re_path(r"^trade[/]?$", tradeRecordApis.crud),
    re_path(r"^dividend[/]?$", cashDividendRecordApis.crud),
]
