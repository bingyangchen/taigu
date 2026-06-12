from django.urls import re_path

from main.market import views

urlpatterns = [
    re_path(r"^market-index[/]?$", views.market_index),
    re_path(
        r"^market-index-historical-prices[/]?$", views.market_index_historical_prices
    ),
    re_path(r"^current-stock-info[/]?$", views.current_stock_info),
    re_path(r"^intraday-prices[/]?$", views.intraday_prices),
    re_path(r"^historical-prices[/]?$", views.historical_prices),
    re_path(r"^search[/]?$", views.search),
    re_path(r"^company-names[/]?$", views.company_names),
]
