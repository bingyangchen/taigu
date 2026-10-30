from datetime import datetime

from dateutil.relativedelta import relativedelta
from django.utils import timezone

from main.billing.models import BillingInterval, BillingProfile, SubscriptionPayment


def get_period_end(first_paid_at: datetime, interval: str, period: int) -> datetime:
    """
    Calculate the period end using Taiwan calendar dates.

    Adding calendar months or years in UTC can shift the billing date.
    For a first payment at 2026-10-01 02:00 UTC+8
    (2026-09-30 18:00 UTC), adding one month gives:

    - Convert to UTC+8, then add one month: 2026-11-01 02:00 UTC+8.
    - Add one month in UTC, then convert to UTC+8: 2026-10-31 02:00 UTC+8.
    """
    started_at = timezone.localtime(first_paid_at)
    if interval == BillingInterval.YEAR:
        return started_at + relativedelta(years=period)
    return started_at + relativedelta(months=period)


def get_next_period_end(profile: BillingProfile) -> datetime:
    """
    Counted from the subscription's first payment rather than from the current period's
    end, because a month without the first payment's day shortens only that period
    (BILL-R14).
    """
    first_paid_at = get_initial_payment(profile).paid_at
    started_at = timezone.localtime(first_paid_at)
    ends_at = timezone.localtime(profile.current_period_ends_at)
    months = (ends_at.year - started_at.year) * 12 + ends_at.month - started_at.month
    period = (
        months // 12 if profile.billing_interval == BillingInterval.YEAR else months
    )
    return get_period_end(first_paid_at, profile.billing_interval, period + 1)


def get_initial_payment(profile: BillingProfile) -> SubscriptionPayment:
    if profile.initial_payment is None:
        raise ValueError(
            f"Auto-renewing billing profile {profile.pk} has no initial payment"
        )
    return profile.initial_payment
