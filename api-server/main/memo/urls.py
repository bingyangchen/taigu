from django.urls import re_path

from main.memo import views

urlpatterns = [
    re_path(r"^stock-memo/(?P<sid>\w+)[/]?$", views.update_or_create_stock_memo),
    re_path(r"^company-info[/]?$", views.list_company_info),
    re_path(r"^trade-plans[/]?$", views.create_or_list_trade_plan),
    re_path(r"^trade-plan/(?P<id>\w+)[/]?$", views.update_or_delete_trade_plan),
    re_path(r"^favorites[/]?$", views.list_favorites),
    re_path(r"^favorite/(?P<sid>\w+)[/]?$", views.create_or_delete_favorite),
]
