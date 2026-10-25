from datetime import date, datetime, time, timedelta
from decimal import ROUND_HALF_UP, Decimal
from enum import StrEnum

from django.db import connection
from django.db.models import Count, DateField, F, Min, Q
from django.db.models.functions import TruncDate, TruncWeek
from django.utils import timezone

from main.account.models import User
from main.usage.models import DailyActivity


class ChartRange(StrEnum):
    NINETY_DAYS = "90"
    ALL = "all"


class _RetentionCellStatus(StrEnum):
    NO_SIGNUPS = "no_signups"
    IN_PROGRESS = "in_progress"
    COMPLETE = "complete"


_ACTIVE_USER_METRIC_TO_WINDOW_DAYS = {"dau": 1, "wau": 7, "mau": 30}
_CHART_RANGE_DAYS = 90
_SUMMARY_COMPARISON_DAYS = 7
_LONGEST_WINDOW_DAYS = max(_ACTIVE_USER_METRIC_TO_WINDOW_DAYS.values())

# A user counts toward a day's DAU, WAU, or MAU when the user has an activity within
# the window's length of days ending on that day, so an activity on day d keeps its
# user counted from d through d + window - 1. The query adds +1 on d and -1 on
# d + window, then sums the changes in date order. When the user's next activity
# comes sooner, the -1 moves to that day because the next activity starts its own
# span, so no user is counted twice on a day. Activities from longest_window - 1
# days before first_day are read so the first day's windows are complete, and
# generate_series gives every day a row even when nothing changes on it.
_ACTIVE_USER_COUNTS_SQL = """
    WITH activity AS (
        SELECT DISTINCT user_id, date
        FROM daily_activity
        WHERE date > %(first_day)s::date - %(longest_window)s
            AND date <= %(last_day)s::date
    ),
    spans AS (
        SELECT date, LEAD(date) OVER (PARTITION BY user_id ORDER BY date) AS next_date
        FROM activity
    ),
    windows (name, days) AS (
        VALUES ('dau', %(dau)s), ('wau', %(wau)s), ('mau', %(mau)s)
    ),
    changes AS (
        SELECT windows.name, spans.date AS day, 1 AS change
        FROM spans CROSS JOIN windows
        UNION ALL
        SELECT windows.name, LEAST(spans.next_date, spans.date + windows.days), -1
        FROM spans CROSS JOIN windows
    ),
    day_changes AS (
        SELECT
            series.day::date AS day,
            COALESCE(SUM(changes.change) FILTER (WHERE changes.name = 'dau'), 0) AS dau,
            COALESCE(SUM(changes.change) FILTER (WHERE changes.name = 'wau'), 0) AS wau,
            COALESCE(SUM(changes.change) FILTER (WHERE changes.name = 'mau'), 0) AS mau
        FROM generate_series(
            %(first_day)s::date - %(longest_window)s + 1,
            %(last_day)s::date,
            interval '1 day'
        ) AS series (day)
        LEFT JOIN changes ON changes.day = series.day::date
        GROUP BY series.day
    ),
    day_counts AS (
        SELECT
            day,
            SUM(dau) OVER by_day AS dau,
            SUM(wau) OVER by_day AS wau,
            SUM(mau) OVER by_day AS mau
        FROM day_changes
        WINDOW by_day AS (ORDER BY day)
    )
    SELECT day, dau, wau, mau
    FROM day_counts
    WHERE day >= %(first_day)s::date
"""

# Inclusive day ranges counted from the signup day, which is day 0.
_RETENTION_CELL_TO_DAY_RANGE = {"day_1": (1, 6), "day_7": (7, 13), "day_30": (30, 36)}


def get_recording_start() -> date | None:
    return DailyActivity.objects.aggregate(start=Min("date"))["start"]


def get_usage_summary(
    today: date, recording_start: date | None, ninety_day_usage: list[dict]
) -> dict:
    yesterday = today - timedelta(days=1)
    week_ago = yesterday - timedelta(days=_SUMMARY_COMPARISON_DAYS)
    registered = User.objects.aggregate(
        by_yesterday=Count("pk", filter=Q(date_joined__lt=_make_day_start(today))),
        by_week_ago=Count(
            "pk",
            filter=Q(date_joined__lt=_make_day_start(week_ago + timedelta(days=1))),
        ),
    )
    summary: dict = {
        "yesterday": yesterday.isoformat(),
        "compared_with": week_ago.isoformat(),
        "registered": {
            "value": registered["by_yesterday"],
            "change": registered["by_yesterday"] - registered["by_week_ago"],
        },
    }

    if recording_start is None or yesterday < recording_start:
        return {**summary, **dict.fromkeys(_ACTIVE_USER_METRIC_TO_WINDOW_DAYS)}

    date_to_usage = {day["date"]: day for day in ninety_day_usage}
    yesterday_usage = date_to_usage[yesterday.isoformat()]
    week_ago_usage = (
        date_to_usage[week_ago.isoformat()] if week_ago >= recording_start else None
    )
    for metric in _ACTIVE_USER_METRIC_TO_WINDOW_DAYS:
        value = yesterday_usage[metric]
        summary[metric] = {
            "value": value,
            "change": value - week_ago_usage[metric] if week_ago_usage else None,
        }
    return summary


def get_daily_usage(
    today: date, recording_start: date | None, chart_range: ChartRange
) -> list[dict]:
    if recording_start is None:
        return []

    start = (
        recording_start
        if chart_range == ChartRange.ALL
        else max(recording_start, today - timedelta(days=_CHART_RANGE_DAYS - 1))
    )
    day_to_active_user_counts = _count_active_users_by_day(start, today)
    day_to_signups = dict(
        User.objects.filter(date_joined__gte=_make_day_start(start))
        .annotate(day=TruncDate("date_joined"))
        .values("day")
        .annotate(count=Count("pk"))
        .values_list("day", "count")
    )
    days = []
    day = start
    while day <= today:
        days.append(
            {
                "date": day.isoformat(),
                **day_to_active_user_counts[day],
                "signups": day_to_signups.get(day, 0),
                "is_incomplete": day - timedelta(days=_LONGEST_WINDOW_DAYS - 1)
                < recording_start,
            }
        )
        day += timedelta(days=1)
    return days


def get_retention(today: date, recording_start: date | None) -> list[dict]:
    if recording_start is None:
        return []

    first_monday = recording_start + timedelta(days=(7 - recording_start.weekday()) % 7)
    last_monday = today - timedelta(days=today.weekday())
    if first_monday > last_monday:
        return []

    joined_since = _make_day_start(first_monday)
    joined_before = _make_day_start(last_monday + timedelta(days=7))
    monday_to_signups = dict(
        User.objects.filter(
            date_joined__gte=joined_since, date_joined__lt=joined_before
        )
        .annotate(week=TruncWeek("date_joined", output_field=DateField()))
        .values("week")
        .annotate(count=Count("pk"))
        .values_list("week", "count")
    )

    longest_retention_days = max(
        last_day for _, last_day in _RETENTION_CELL_TO_DAY_RANGE.values()
    )
    monday_to_retained = {
        row["week"]: row
        for row in DailyActivity.objects.filter(
            user__date_joined__gte=joined_since, user__date_joined__lt=joined_before
        )
        .annotate(
            signup_day=TruncDate("user__date_joined"),
            week=TruncWeek("user__date_joined", output_field=DateField()),
        )
        # Compare `date` itself with bounds so the per-user date range can use
        # the (user_id, date, platform) index; filtering on `date - signup_day`
        # cannot.
        .filter(
            date__gt=F("signup_day"),
            date__lte=F("signup_day") + timedelta(days=longest_retention_days),
        )
        .values("week")
        .annotate(
            **{
                name: Count(
                    "user",
                    distinct=True,
                    filter=Q(
                        date__gte=F("signup_day") + timedelta(days=first_day),
                        date__lte=F("signup_day") + timedelta(days=last_day),
                    ),
                )
                for name, (first_day, last_day) in _RETENTION_CELL_TO_DAY_RANGE.items()
            }
        )
    }

    weeks = []
    monday = last_monday
    while monday >= first_monday:
        sunday = monday + timedelta(days=6)
        signups = monday_to_signups.get(monday, 0)
        retained = monday_to_retained.get(monday, {})
        weeks.append(
            {
                "week_start": monday.isoformat(),
                "signups": signups,
                **{
                    name: _make_retention_cell(
                        signups,
                        retained.get(name, 0),
                        is_in_progress=sunday + timedelta(days=last_day) >= today,
                    )
                    for name, (_, last_day) in _RETENTION_CELL_TO_DAY_RANGE.items()
                },
            }
        )
        monday -= timedelta(days=7)
    return weeks


def _make_retention_cell(signups: int, count: int, *, is_in_progress: bool) -> dict:
    if signups == 0:
        return {
            "status": _RetentionCellStatus.NO_SIGNUPS,
            "count": None,
            "percent": None,
        }
    if is_in_progress:
        return {
            "status": _RetentionCellStatus.IN_PROGRESS,
            "count": None,
            "percent": None,
        }
    percent = (Decimal(count * 100) / signups).quantize(
        Decimal(1), rounding=ROUND_HALF_UP
    )
    return {
        "status": _RetentionCellStatus.COMPLETE,
        "count": count,
        "percent": int(percent),
    }


def _make_day_start(day: date) -> datetime:
    return timezone.make_aware(datetime.combine(day, time()))


def _count_active_users_by_day(first_day: date, last_day: date) -> dict[date, dict]:
    with connection.cursor() as cursor:
        cursor.execute(
            _ACTIVE_USER_COUNTS_SQL,
            {
                "first_day": first_day,
                "last_day": last_day,
                "longest_window": _LONGEST_WINDOW_DAYS,
                **_ACTIVE_USER_METRIC_TO_WINDOW_DAYS,
            },
        )
        return {
            # SUM returns a numeric, which the driver reads as Decimal.
            day: {"dau": int(dau), "wau": int(wau), "mau": int(mau)}
            for day, dau, wau, mau in cursor.fetchall()
        }
