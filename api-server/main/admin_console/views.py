from datetime import datetime
from enum import StrEnum

from django.db import connection
from django.db.models import BooleanField
from django.db.models.expressions import RawSQL
from django.http import HttpRequest, JsonResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt, csrf_protect
from django.views.decorators.http import require_GET, require_POST

from main.admin_console.services import subscription as subscription_service
from main.admin_console.services import usage as usage_service
from main.core.decorators.auth import require_login, require_superuser
from main.issue_report.models import IssueReport


class _IssueReportFilter(StrEnum):
    UNHANDLED = "unhandled"
    ALL = "all"


_ISSUE_REPORT_PAGE_SIZE = 10
_BOOLEAN_STRINGS = {"true": True, "false": False}


@require_login
@require_superuser
@require_GET
def usage(request: HttpRequest) -> JsonResponse:
    today = timezone.localdate()
    recording_start = usage_service.get_recording_start()
    ninety_day_usage = usage_service.get_daily_usage(
        today, recording_start, usage_service.ChartRange.NINETY_DAYS
    )
    return JsonResponse(
        {
            "recording_started_on": recording_start.isoformat()
            if recording_start
            else None,
            "summary": usage_service.get_usage_summary(
                today, recording_start, ninety_day_usage
            ),
            "days": ninety_day_usage,
            "retention": usage_service.get_retention(today, recording_start),
        }
    )


@require_login
@require_superuser
@require_GET
def all_daily_usage(request: HttpRequest) -> JsonResponse:
    return JsonResponse(
        {
            "days": usage_service.get_daily_usage(
                timezone.localdate(),
                usage_service.get_recording_start(),
                usage_service.ChartRange.ALL,
            )
        }
    )


@require_login
@require_superuser
@require_GET
def subscriptions(request: HttpRequest) -> JsonResponse:
    now = timezone.now()
    return JsonResponse(
        {
            "statuses": subscription_service.get_subscription_status_counts(),
            "whitelisted": subscription_service.count_whitelisted_users(),
            "trial_conversions": subscription_service.get_trial_conversions(now),
            "monthly_payments": subscription_service.get_monthly_payments(
                timezone.localdate(now)
            ),
        }
    )


@require_login
@require_superuser
@require_GET
def list_issue_reports(request: HttpRequest) -> JsonResponse:
    try:
        report_filter = _IssueReportFilter(
            request.GET.get("filter", _IssueReportFilter.UNHANDLED)
        )
    except ValueError:
        return JsonResponse({"message": "Invalid filter"}, status=400)

    reports = IssueReport.objects.select_related("user").order_by("-created_at", "-id")
    if report_filter == _IssueReportFilter.UNHANDLED:
        reports = reports.filter(handled_at__isnull=True)
    if cursor_text := request.GET.get("cursor"):
        cursor = _parse_cursor(cursor_text)
        if cursor is None:
            return JsonResponse({"message": "Invalid cursor"}, status=400)

        created_at, report_id = cursor

        # A row comparison, unlike the equivalent OR of two conditions, lets
        # PostgreSQL start the index scan right after the cursor.
        reports = reports.filter(
            RawSQL(
                '("issue_report"."created_at", "issue_report"."id") < (%s, %s)',
                (created_at, report_id),
                output_field=BooleanField(),
            )
        )

    page = list(reports[: _ISSUE_REPORT_PAGE_SIZE + 1])
    has_more = len(page) > _ISSUE_REPORT_PAGE_SIZE
    page = page[:_ISSUE_REPORT_PAGE_SIZE]
    return JsonResponse(
        {
            "reports": [_serialize_issue_report(report) for report in page],
            "next_cursor": _make_cursor(page[-1]) if has_more else None,
        }
    )


@require_login
@require_superuser
@require_GET
def count_unhandled_issue_reports(request: HttpRequest) -> JsonResponse:
    return JsonResponse({"count": _count_unhandled_issue_reports()})


@csrf_exempt
@require_login
@require_superuser
@csrf_protect  # After require_superuser: non-superusers get 404, not 403 (ADMIN-R1)
@require_POST
def update_issue_report_handled(request: HttpRequest, report_id: str) -> JsonResponse:
    is_handled = _BOOLEAN_STRINGS.get(request.POST.get("is_handled", ""))
    if is_handled is None:
        return JsonResponse({"message": "Invalid is_handled"}, status=400)

    report = get_object_or_404(IssueReport.objects.select_related("user"), pk=report_id)
    if (report.handled_at is not None) != is_handled:
        report.handled_at = timezone.now() if is_handled else None
        report.save(update_fields=["handled_at", "updated_at"])
    return JsonResponse(
        {
            "report": _serialize_issue_report(report),
            "unhandled_count": _count_unhandled_issue_reports(),
        }
    )


def _count_unhandled_issue_reports() -> int:
    return IssueReport.objects.filter(handled_at__isnull=True).count()


def _serialize_issue_report(report: IssueReport) -> dict:
    return {
        "id": report.pk,
        "email": report.user.email,
        "platform": report.platform,
        "user_agent": report.user_agent or None,  # An empty header is stored as ""
        "body": report.body,
        "created_at": report.created_at.isoformat(),
        "is_handled": report.handled_at is not None,
    }


def _make_cursor(report: IssueReport) -> str:
    return f"{report.created_at.isoformat()}_{report.pk}"


def _parse_cursor(text: str) -> tuple[datetime, int] | None:
    created_at_text, _, report_id_text = text.rpartition("_")
    try:
        created_at = datetime.fromisoformat(created_at_text)
        report_id = int(report_id_text)
    except ValueError:
        return None

    _, max_report_id = connection.ops.integer_field_range(
        IssueReport._meta.pk.get_internal_type()
    )
    if timezone.is_naive(created_at) or report_id > max_report_id:
        return None

    return created_at, report_id
