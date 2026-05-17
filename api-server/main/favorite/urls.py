from django.urls import re_path

from main.favorite import views

urlpatterns = [
    re_path(r"^$", views.list_favorites),
    re_path(r"^(?P<sid>\w+)[/]?$", views.create_or_delete_favorite),
]
