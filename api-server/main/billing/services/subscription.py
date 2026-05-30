from datetime import datetime
from typing import Literal

from dateutil.relativedelta import relativedelta
from django.db import transaction
from django.utils import timezone

from main.account.models import User
from main.billing.models import (
    BillingInterval,
    BillingProfile,
    Currency,
    PaymentStatus,
    Plan,
    SubscriptionPayment,
    SubscriptionStatus,
)
from main.billing.services.card import get_default_active_card
from main.billing.services.ecpay import (
    EcpayApiError,
    EcpayClient,
    generate_merchant_trade_no,
    get_ecpay_return_url,
)
from main.billing.services.entitlements import ensure_billing_profile

STANDARD_PRICES = {BillingInterval.MONTH: 65, BillingInterval.YEAR: 700}
STANDARD_CURRENCY = Currency.TWD
RenewalResult = Literal["renewed", "past_due", "canceled"]


def _next_period_end(interval: str) -> datetime:
    now = timezone.now()
    if interval == BillingInterval.YEAR:
        return now + relativedelta(years=1)
    return now + relativedelta(months=1)


def create_subscription_payment(
    *, user: User, interval: str, client: EcpayClient | None = None
) -> SubscriptionPayment:
    if interval not in STANDARD_PRICES:
        raise ValueError("Unsupported billing interval")

    card = get_default_active_card(user)
    if card is None or not card.provider_binding_id:
        raise ValueError("No active bound card")

    ecpay_client = client or EcpayClient()
    payment = SubscriptionPayment.objects.create(
        user=user,
        card_binding=card,
        provider_request_id=generate_merchant_trade_no("S"),
        plan=Plan.STANDARD,
        billing_interval=interval,
        currency=STANDARD_CURRENCY,
        amount=STANDARD_PRICES[interval],
    )
    response = ecpay_client.create_payment_with_card_id(
        bind_card_id=card.provider_binding_id,
        user_id=user.id,
        user_email=user.email,
        user_name=user.username,
        merchant_trade_no=payment.provider_request_id,
        amount=payment.amount,
        return_url=get_ecpay_return_url(),
    )
    payment.raw_response = response
    payment.save()
    if response.get("RtnCode") == 1:
        mark_payment_paid(payment, response)
        payment.refresh_from_db()
    return payment


def renew_due_subscriptions(
    *, client: EcpayClient | None = None, now: datetime | None = None
) -> dict[str, int]:
    now = now or timezone.now()
    summary = {"renewed": 0, "past_due": 0, "canceled": 0}

    due_profile_ids = list(
        BillingProfile.objects.filter(
            plan=Plan.STANDARD,
            subscription_status__in=[
                SubscriptionStatus.ACTIVE,
                SubscriptionStatus.PAST_DUE,
            ],
            current_period_ends_at__lte=now,
        ).values_list("pk", flat=True)
    )
    for profile_id in due_profile_ids:
        result = _renew_due_subscription(profile_id=profile_id, client=client, now=now)
        if result is not None:
            summary[result] += 1

    expired_trials = BillingProfile.objects.filter(
        plan=Plan.STANDARD,
        subscription_status=SubscriptionStatus.TRIALING,
        trial_ends_at__lte=now,
    )
    summary["canceled"] += expired_trials.update(
        plan=Plan.FREE, subscription_status=SubscriptionStatus.CANCELED, updated_at=now
    )
    return summary


@transaction.atomic
def _renew_due_subscription(
    *, profile_id: int, client: EcpayClient | None, now: datetime
) -> RenewalResult | None:
    profile = (
        BillingProfile.objects.select_for_update(skip_locked=True)
        .select_related("user")
        .filter(
            pk=profile_id,
            plan=Plan.STANDARD,
            subscription_status__in=[
                SubscriptionStatus.ACTIVE,
                SubscriptionStatus.PAST_DUE,
            ],
            current_period_ends_at__lte=now,
        )
        .first()
    )
    if profile is None:
        return None

    if profile.cancel_at_period_end:
        profile.plan = Plan.FREE
        profile.subscription_status = SubscriptionStatus.CANCELED
        profile.cancel_at_period_end = False
        profile.save()
        return "canceled"

    try:
        payment = create_subscription_payment(
            user=profile.user, interval=profile.billing_interval, client=client
        )
    except (EcpayApiError, ValueError):
        profile.subscription_status = SubscriptionStatus.PAST_DUE
        profile.save()
        return "past_due"

    if payment.status == PaymentStatus.PAID:
        return "renewed"

    profile.subscription_status = SubscriptionStatus.PAST_DUE
    profile.save()
    return "past_due"


@transaction.atomic
def mark_payment_paid(payment: SubscriptionPayment, data: dict) -> None:
    payment = SubscriptionPayment.objects.select_for_update().get(pk=payment.pk)
    if payment.status == PaymentStatus.PAID:
        return
    order_info = data.get("OrderInfo", {})
    payment.status = PaymentStatus.PAID
    payment.provider_transaction_id = order_info.get("TradeNo")
    payment.paid_at = timezone.now()
    payment.raw_response = data
    payment.save()

    profile = ensure_billing_profile(payment.user)
    profile.plan = Plan.STANDARD
    profile.subscription_status = SubscriptionStatus.ACTIVE
    profile.billing_interval = payment.billing_interval
    profile.current_period_started_at = timezone.now()
    profile.current_period_ends_at = _next_period_end(payment.billing_interval)
    profile.cancel_at_period_end = False
    profile.save()


@transaction.atomic
def mark_payment_failed(provider_request_id: str, data: dict) -> None:
    payment = SubscriptionPayment.objects.select_for_update().get(
        provider_request_id=provider_request_id
    )
    payment.status = PaymentStatus.FAILED
    payment.failure_message = data.get("RtnMsg", "")
    payment.raw_response = data
    payment.save()
