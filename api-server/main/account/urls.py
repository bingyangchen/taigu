from django.urls import re_path

from main.account import views

urlpatterns = [
    re_path(r"^csrf-token[/]?$", views.csrf_token),
    re_path(r"^authorization-url[/]?$", views.get_authorization_url),
    re_path(r"^google-login[/]?$", views.google_login),
    re_path(r"^refresh-token[/]?$", views.refresh_token),
    re_path(r"^logout[/]?$", views.logout),
    re_path(r"^me[/]?$", views.me),
    re_path(r"^open-session[/]?$", views.open_session),
    re_path(r"^update[/]?$", views.update),
    re_path(r"^change-binding[/]?$", views.change_google_binding),
    # re_path(r"^delete[/]?$", views.delete),
]
