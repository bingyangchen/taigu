from django.urls import re_path

from .views import cashDividendRecord, stockInfo, tradeRecord

urlpatterns = [
    re_path(r"^info[/]?$", stockInfo.all_companies_single_day),
    re_path(r"^info/(?P<sid>\w+)[/]?$", stockInfo.single_company_multiple_days),
    re_path(r"^trade-records[/]?$", tradeRecord.create_or_list),
    re_path(r"^trade-records/(?P<id>\w+)[/]?$", tradeRecord.update_or_delete),
    re_path(r"^cash-dividends[/]?$", cashDividendRecord.create_or_list),
    re_path(r"^cash-dividends/(?P<id>\w+)[/]?$", cashDividendRecord.update_or_delete),
]
