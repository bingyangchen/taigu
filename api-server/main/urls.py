from django.urls import include, re_path

urlpatterns = [
    re_path(r"^api/account/", include("main.account.urls")),
    re_path(r"^api/market/", include("main.market.urls")),
    re_path(r"^api/stock-memo/", include("main.stock_memo.urls")),
    re_path(r"^api/trade-plans/?", include("main.trade_plan.urls")),
    re_path(r"^api/favorites/?", include("main.favorite.urls")),
    re_path(r"^api/trade-records/?", include("main.trade_record.urls")),
    re_path(r"^api/cash-dividends/?", include("main.cash_dividend.urls")),
    re_path(r"^api/handling-fee/", include("main.handling_fee.urls")),
]
