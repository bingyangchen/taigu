from django.urls import re_path

from .views import cashDividendRecordApis, tradeRecordApis, stockInfoApis

urlpatterns = [
    re_path(r"^info[/]?$", stockInfoApis.info),
    re_path(r"^trade-record[/]?$", tradeRecordApis.crud),
    re_path(
        r"^cash-dividends[/]?$",
        cashDividendRecordApis.create_or_list_cash_dividend_record,
    ),
    re_path(
        r"^cash-dividend/(?P<id>\w+)[/]?$",
        cashDividendRecordApis.update_or_delete_cash_dividend_record,
    ),
]
