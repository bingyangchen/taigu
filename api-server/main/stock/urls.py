from django.urls import re_path

from .views import cash_dividend_record, stock_info, trade_record

urlpatterns = [
    re_path(r"^market-index[/]?$", stock_info.market_index),
    re_path(r"^current-stock-info[/]?$", stock_info.current_stock_info),
    re_path(r"^historical-prices/(?P<sid>\w+)[/]?$", stock_info.historical_prices),
    re_path(r"^search[/]?$", stock_info.search),
    re_path(r"^trade-records[/]?$", trade_record.create_or_list),
    re_path(r"^trade-records/(?P<id>\w+)[/]?$", trade_record.update_or_delete),
    re_path(r"^cash-dividends[/]?$", cash_dividend_record.create_or_list),
    re_path(r"^cash-dividends/(?P<id>\w+)[/]?$", cash_dividend_record.update_or_delete),
]
