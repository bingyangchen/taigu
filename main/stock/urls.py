from django.urls import re_path

from .views import cash_dividend_record, stock_info, trade_record

urlpatterns = [
    re_path(r"^latest_market_index[/]?$", stock_info.latest_market_index),
    re_path(
        r"^multiple_companies_single_day[/]?$", stock_info.multiple_companies_single_day
    ),
    re_path(
        r"^single_company_multiple_days/(?P<sid>\w+)[/]?$",
        stock_info.single_company_multiple_days,
    ),
    re_path(r"^search[/]?$", stock_info.search),
    re_path(r"^trade-records[/]?$", trade_record.create_or_list),
    re_path(r"^trade-records/(?P<id>\w+)[/]?$", trade_record.update_or_delete),
    re_path(r"^cash-dividends[/]?$", cash_dividend_record.create_or_list),
    re_path(r"^cash-dividends/(?P<id>\w+)[/]?$", cash_dividend_record.update_or_delete),
]
