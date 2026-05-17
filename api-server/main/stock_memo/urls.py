from django.urls import re_path

from main.stock_memo import views

urlpatterns = [
    re_path(r"^company-info[/]?$", views.list_company_info),
    re_path(r"^(?P<sid>\w+)[/]?$", views.update_or_create_stock_memo),
]
