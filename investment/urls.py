from django.urls import include, re_path

urlpatterns = [
    re_path(r"^api/account/", include("investment.account.urls")),
    re_path(r"^api/stock/", include("investment.stock.urls")),
    re_path(r"^api/memo/", include("investment.memo.urls")),
]
