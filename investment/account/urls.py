from django.urls import path

from . import apis

urlpatterns = [
    path("register", apis.register),
    path("login", apis.login),
    path("logout", apis.logout),
    path("check-login", apis.check_login),
    path("update", apis.update),
]
