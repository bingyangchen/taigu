from django.urls import re_path

from main.core import views

urlpatterns = [re_path(r"^$", views.health)]
