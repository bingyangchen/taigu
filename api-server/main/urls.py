from django.urls import include, re_path

urlpatterns = [
    re_path(r"^api/account/", include("main.account.urls")),
    re_path(r"^api/stock/", include("main.stock.urls")),
    re_path(r"^api/stock-memo/", include("main.stock_memo.urls")),
    re_path(r"^api/trade-plans/?", include("main.trade_plan.urls")),
    re_path(r"^api/favorites/?", include("main.favorite.urls")),
    re_path(r"^api/handling-fee/", include("main.handling_fee.urls")),
]
