from django.urls import re_path

from . import views

urlpatterns = [
    re_path(r"^google-login[/]?$", views.google_login),
    re_path(r"^logout[/]?$", views.logout),
    re_path(r"^me[/]?$", views.me),
    re_path(r"^update[/]?$", views.update),
    # re_path(r"^delete[/]?$", views.delete),
]
