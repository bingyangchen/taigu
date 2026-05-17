from django.urls import re_path

from main.trade_plan import views

urlpatterns = [
    re_path(r"^$", views.create_or_list_trade_plans),
    re_path(r"^(?P<id>\w+)[/]?$", views.update_or_delete_trade_plan),
]
