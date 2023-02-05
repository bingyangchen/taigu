from django.urls import re_path

from .views import cashDividendRecordApis, tradeRecordApis, stockInfoApis

urlpatterns = [
    re_path(r"^info[/]?$", stockInfoApis.info),
    re_path(r"^trade-records[/]?$", tradeRecordApis.create_or_list_trade_record),
    re_path(
        r"^trade-records/(?P<id>\w+)[/]?$",
        tradeRecordApis.update_or_delete_trade_record,
    ),
    re_path(
        r"^cash-dividends[/]?$",
        cashDividendRecordApis.create_or_list_cash_dividend_record,
    ),
    re_path(
        r"^cash-dividends/(?P<id>\w+)[/]?$",
        cashDividendRecordApis.update_or_delete_cash_dividend_record,
    ),
]
