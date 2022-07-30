from django.urls import re_path

from . import apis

urlpatterns = [
    re_path(r"^register[/]?$", apis.register),
    re_path(r"^login[/]?$", apis.login),
    re_path(r"^logout[/]?$", apis.logout),
    re_path(r"^check-login[/]?$", apis.check_login),
    re_path(r"^update[/]?$", apis.update),
]
