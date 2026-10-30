from datetime import date, datetime, time, timedelta
from decimal import ROUND_HALF_UP, Decimal
from enum import StrEnum

from dateutil.relativedelta import relativedelta
from django.db.models import Count, DateField, Exists, OuterRef, Q, Sum
from django.db.models.functions import TruncMonth
from django.utils import timezone

from main.account.models import User
from main.billing.models import (
    BillingProfile,
    PaymentStatus,
    StandardWhitelist,
    SubscriptionPayment,
    SubscriptionStatus,
)
from main.billing.services.entitlements import TRIAL_LENGTH

_TRIAL_CONVERSION_WINDOW = timedelta(days=30)


class _SubscriptionStatusKey(StrEnum):
    TRIALING = "trialing"
    AUTO_RENEWING = "auto_renewing"
    AUTO_RENEWAL_STOPPED = "auto_renewal_stopped"
    UNSUBSCRIBED = "unsubscribed"


class _CohortStatus(StrEnum):
    SETTLED = "settled"
    IN_PROGRESS = "in_progress"


def get_subscription_status_counts() -> dict[str, int]:
    status_key_to_count = dict.fromkeys(_SubscriptionStatusKey, 0)
    for status, cancel_at_period_end, count in (
        BillingProfile.objects.values("subscription_status", "cancel_at_period_end")
        .annotate(count=Count("pk"))
        .values_list("subscription_status", "cancel_at_period_end", "count")
    ):
        status_key_to_count[
            _get_status_key(status, cancel_at_period_end=cancel_at_period_end)
        ] += count
    status_key_to_count[_SubscriptionStatusKey.UNSUBSCRIBED] += User.objects.filter(
        billing_profile__isnull=True
    ).count()
    return status_key_to_count


def count_whitelisted_users() -> int:
    return StandardWhitelist.objects.count()


def get_trial_conversions(now: datetime) -> list[dict]:
    month_to_counts = {
        month: (trial_count, paid_count)
        for month, trial_count, paid_count in (
            BillingProfile.objects.filter(
                trial_started_at__isnull=False,
                trial_ends_at__isnull=False,
                user__standard_whitelist__isnull=True,
            )
            .annotate(
                converted=Exists(
                    SubscriptionPayment.objects.filter(
                        user=OuterRef("user"),
                        status=PaymentStatus.PAID,
                        paid_at__lte=OuterRef("trial_ends_at")
                        + _TRIAL_CONVERSION_WINDOW,
                    )
                ),
                month=TruncMonth("trial_started_at", output_field=DateField()),
            )
            .values("month")
            .annotate(trials=Count("pk"), paid=Count("pk", filter=Q(converted=True)))
            .values_list("month", "trials", "paid")
        )
    }
    if not month_to_counts:
        return []

    rows = []
    for month in _make_months(min(month_to_counts), timezone.localdate(now)):
        trial_count, paid_count = month_to_counts.get(month, (0, 0))
        row = {
            "month": month.strftime("%Y-%m"),
            "trials": trial_count,
            "paid": paid_count,
            "conversion_rate": None,
            "status": None,
            "settles_on": None,
        }
        if trial_count > 0:
            # A cohort's last trial ends at most TRIAL_LENGTH after its month ends.
            settles_at = (
                timezone.make_aware(
                    datetime.combine(month + relativedelta(months=1), time())
                )
                + TRIAL_LENGTH
                + _TRIAL_CONVERSION_WINDOW
            )
            row["conversion_rate"] = str(
                (Decimal(paid_count * 100) / trial_count).quantize(
                    Decimal("0.1"), rounding=ROUND_HALF_UP
                )
            )
            if now >= settles_at:
                row["status"] = _CohortStatus.SETTLED
            else:
                row["status"] = _CohortStatus.IN_PROGRESS
                row["settles_on"] = (
                    timezone.localdate(settles_at) - timedelta(days=1)
                ).isoformat()
        rows.append(row)
    return rows[::-1]


def get_monthly_payments(today: date) -> list[dict]:
    month_to_totals = {
        month: (count, amount)
        for month, count, amount in (
            SubscriptionPayment.objects.filter(status=PaymentStatus.PAID)
            .annotate(month=TruncMonth("paid_at", output_field=DateField()))
            .values("month")
            .annotate(count=Count("pk"), amount=Sum("amount"))
            .values_list("month", "count", "amount")
        )
    }
    if not month_to_totals:
        return []

    rows = []
    for month in _make_months(min(month_to_totals), today):
        count, amount = month_to_totals.get(month, (0, 0))
        rows.append(
            {"month": month.strftime("%Y-%m"), "count": count, "amount": amount}
        )
    return rows


def _get_status_key(
    status: str, *, cancel_at_period_end: bool
) -> _SubscriptionStatusKey:
    match status:
        case SubscriptionStatus.TRIALING:
            return _SubscriptionStatusKey.TRIALING
        case SubscriptionStatus.ACTIVE:
            return (
                _SubscriptionStatusKey.AUTO_RENEWAL_STOPPED
                if cancel_at_period_end
                else _SubscriptionStatusKey.AUTO_RENEWING
            )
        case SubscriptionStatus.CANCELED:
            return _SubscriptionStatusKey.UNSUBSCRIBED
        case _:
            raise ValueError(f"Unknown subscription status: {status}")


def _make_months(first_month: date, today: date) -> list[date]:
    months = []
    month = first_month
    while month <= today:
        months.append(month)
        month += relativedelta(months=1)
    return months
