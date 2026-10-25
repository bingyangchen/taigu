from django.urls import re_path

from main.admin_console import views

urlpatterns = [
    re_path(r"^usage[/]?$", views.usage),
    re_path(r"^usage/daily[/]?$", views.all_daily_usage),
    re_path(r"^subscriptions[/]?$", views.subscriptions),
    re_path(r"^issue-reports[/]?$", views.list_issue_reports),
    re_path(
        r"^issue-reports/unhandled-count[/]?$", views.count_unhandled_issue_reports
    ),
    re_path(
        r"^issue-reports/(?P<report_id>[0-9]{1,19})/handled[/]?$",
        views.update_issue_report_handled,
    ),
]
