from datetime import datetime

from dateutil.relativedelta import relativedelta
from django.utils import timezone

from main.billing.models import BillingInterval, BillingProfile, SubscriptionPayment


def get_period_end(first_paid_at: datetime, interval: str, period: int) -> datetime:
    # Counted in Taiwan time, so that a period ends on ECPay's charge day even when
    # the first payment arrived between 00:00 and 08:00.
    started_at = timezone.localtime(first_paid_at)
    if interval == BillingInterval.YEAR:
        return started_at + relativedelta(years=period)
    return started_at + relativedelta(months=period)


def get_next_period_end(profile: BillingProfile) -> datetime:
    """
    The end of the period after the current one, counted from the subscription's
    first payment rather than from the current period's end, because a month
    without the first payment's day shortens only that period (BILL-R14).
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
