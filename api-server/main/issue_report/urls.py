from django.urls import re_path

from main.issue_report import views

urlpatterns = [re_path(r"^[/]?$", views.create_issue_report)]
