from django.urls import re_path

from main.handling_fee import views

urlpatterns = [
    re_path(r"^discount[/]?$", views.create_or_list_discount),
    re_path(r"^discount/(?P<id>\w+)[/]?$", views.update_or_delete_discount),
]
