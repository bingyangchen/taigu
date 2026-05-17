from django.urls import re_path

from main.trade_record import views

urlpatterns = [
    re_path(r"^$", views.create_or_list),
    re_path(r"^(?P<id>\w+)[/]?$", views.update_or_delete),
]
