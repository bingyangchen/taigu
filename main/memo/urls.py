from django.urls import re_path

from . import views

urlpatterns = [
    re_path(r"^stock-memo/(?P<sid>\w+)[/]?$", views.update_or_create_stock_memo),
    re_path(r"^stock-memo[/]?$", views.list_stock_memo),
    re_path(r"^trade-plans[/]?$", views.create_or_list_trade_plan),
    re_path(r"^trade-plan/(?P<id>\w+)[/]?$", views.update_or_delete_trade_plan),
]
