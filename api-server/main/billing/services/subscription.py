from datetime import datetime, timedelta
from enum import StrEnum
from uuid import UUID

from dateutil.relativedelta import relativedelta
from django.db import IntegrityError, transaction
from django.db.models import QuerySet
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
PENDING_PAYMENT_TTL = timedelta(minutes=30)
STALE_PAYMENT_FAILURE_MESSAGE = "Payment confirmation timed out"


class RenewalResult(StrEnum):
    RENEWED = "renewed"
    PAST_DUE = "past_due"
    CANCELED = "canceled"


PreparedRenewal = SubscriptionPayment | RenewalResult | None
PreparedPayment = tuple[SubscriptionPayment, bool]


class SubscriptionPaymentNotChargeableError(Exception):
    pass


class SubscriptionPaymentValidationError(Exception):
    pass


def _next_period_end(interval: str) -> datetime:
    now = timezone.now()
    if interval == BillingInterval.YEAR:
        return now + relativedelta(years=1)
    return now + relativedelta(months=1)


def create_subscription_payment(
    *, user: User, interval: str, client: EcpayClient | None = None
) -> SubscriptionPayment:
    payment, should_charge = _get_or_create_pending_subscription_payment(
        user=user, interval=interval
    )
    if not should_charge:
        return payment

    try:
        return _charge_subscription_payment(payment_id=payment.id, client=client)
    except (EcpayApiError, SubscriptionPaymentNotChargeableError) as error:
        mark_payment_failed(payment.provider_request_id, {"RtnMsg": str(error)})
        raise


def _expire_stale_pending_payments(*, user: User, now: datetime | None = None) -> int:
    now = now or timezone.now()
    return (
        _stale_pending_payments(now)
        .filter(user=user)
        .update(
            status=PaymentStatus.EXPIRED,
            failure_message=STALE_PAYMENT_FAILURE_MESSAGE,
            updated_at=now,
        )
    )


def expire_all_stale_pending_payments(*, now: datetime | None = None) -> int:
    now = now or timezone.now()
    return _stale_pending_payments(now).update(
        status=PaymentStatus.EXPIRED,
        failure_message=STALE_PAYMENT_FAILURE_MESSAGE,
        updated_at=now,
    )


def _get_or_create_pending_subscription_payment(
    *, user: User, interval: str
) -> PreparedPayment:
    try:
        with transaction.atomic():
            _assert_subscription_can_be_started(user=user)
            _expire_stale_pending_payments(user=user)
            existing_payment = (
                _pending_payments(user=user)
                .select_for_update()
                .order_by("-created_at")
                .first()
            )
            if existing_payment is not None:
                return existing_payment, False

            return _create_pending_subscription_payment(
                user=user, interval=interval
            ), True
    except IntegrityError:
        existing_payment = _pending_payments(user=user).first()
        if existing_payment is not None:
            return existing_payment, False
        raise


def _assert_subscription_can_be_started(*, user: User) -> None:
    ensure_billing_profile(user)
    profile = BillingProfile.objects.select_for_update().get(user=user)
    if (
        profile.plan == Plan.STANDARD
        and profile.subscription_status == SubscriptionStatus.ACTIVE
        and profile.current_period_ends_at
        and profile.current_period_ends_at > timezone.now()
    ):
        raise SubscriptionPaymentNotChargeableError("Subscription is already active")


def _create_pending_subscription_payment(
    *, user: User, interval: str
) -> SubscriptionPayment:
    if interval not in STANDARD_PRICES:
        raise ValueError("Unsupported billing interval")

    card = get_default_active_card(user)
    if card is None or not card.provider_binding_id:
        raise SubscriptionPaymentNotChargeableError("No active bound card")

    return SubscriptionPayment.objects.create(
        user=user,
        card_binding=card,
        provider_request_id=generate_merchant_trade_no("S"),
        plan=Plan.STANDARD,
        billing_interval=interval,
        currency=STANDARD_CURRENCY,
        amount=STANDARD_PRICES[interval],
    )


def _charge_subscription_payment(
    *, payment_id: UUID, client: EcpayClient | None = None
) -> SubscriptionPayment:
    # Re-read by id so retries observe a callback-updated PAID state before charging.
    # This narrows retry risk; the pending-payment guard owns renewal concurrency.
    payment = SubscriptionPayment.objects.select_related("user", "card_binding").get(
        pk=payment_id
    )
    if payment.status == PaymentStatus.PAID:
        return payment
    if payment.card_binding.provider_binding_id is None:
        raise SubscriptionPaymentNotChargeableError("No active bound card")

    ecpay_client = client or EcpayClient()
    response = ecpay_client.create_payment_with_card_id(
        bind_card_id=payment.card_binding.provider_binding_id,
        user_id=payment.user.id,
        user_email=payment.user.email,
        user_name=payment.user.username,
        merchant_trade_no=payment.provider_request_id,
        amount=payment.amount,
        return_url=get_ecpay_return_url(),
    )
    payment.raw_response = response
    payment.save()
    mark_payment_paid(payment, response)
    payment.refresh_from_db()
    return payment


def renew_due_subscriptions(
    *, client: EcpayClient | None = None, now: datetime | None = None
) -> dict[RenewalResult, int]:
    now = now or timezone.now()
    summary = dict.fromkeys(RenewalResult, 0)

    due_profile_ids = list(_due_subscription_profiles(now).values_list("pk", flat=True))
    for profile_id in due_profile_ids:
        result = _renew_due_subscription(profile_id=profile_id, client=client, now=now)
        if result is not None:
            summary[result] += 1

    expired_trials = BillingProfile.objects.filter(
        plan=Plan.STANDARD,
        subscription_status=SubscriptionStatus.TRIALING,
        trial_ends_at__lte=now,
    )
    summary[RenewalResult.CANCELED] += expired_trials.update(
        plan=Plan.FREE, subscription_status=SubscriptionStatus.CANCELED, updated_at=now
    )
    return summary


def _renew_due_subscription(
    *, profile_id: int, client: EcpayClient | None, now: datetime
) -> RenewalResult | None:
    prepared_renewal = _prepare_due_subscription_payment(profile_id=profile_id, now=now)
    if not isinstance(prepared_renewal, SubscriptionPayment):
        return prepared_renewal

    try:
        _charge_subscription_payment(payment_id=prepared_renewal.id, client=client)
    except (EcpayApiError, SubscriptionPaymentNotChargeableError) as error:
        mark_payment_failed(
            prepared_renewal.provider_request_id, {"RtnMsg": str(error)}
        )
        _mark_profile_past_due(profile_id=profile_id, now=now)
        return RenewalResult.PAST_DUE

    return RenewalResult.RENEWED


@transaction.atomic
def _prepare_due_subscription_payment(
    *, profile_id: int, now: datetime
) -> PreparedRenewal:
    profile = (
        _due_subscription_profiles(now)
        .select_for_update(skip_locked=True)
        .select_related("user")
        .filter(pk=profile_id)
        .first()
    )
    if profile is None:
        return None

    if profile.cancel_at_period_end:
        profile.plan = Plan.FREE
        profile.subscription_status = SubscriptionStatus.CANCELED
        profile.cancel_at_period_end = False
        profile.save()
        return RenewalResult.CANCELED

    _expire_stale_pending_payments(user=profile.user, now=now)
    if _pending_payments(user=profile.user).exists():
        return None

    try:
        return _create_pending_subscription_payment(
            user=profile.user, interval=profile.billing_interval
        )
    except SubscriptionPaymentNotChargeableError:
        profile.subscription_status = SubscriptionStatus.PAST_DUE
        profile.save()
        return RenewalResult.PAST_DUE


def _mark_profile_past_due(*, profile_id: int, now: datetime) -> None:
    _due_subscription_profiles(now).filter(pk=profile_id).update(
        subscription_status=SubscriptionStatus.PAST_DUE, updated_at=now
    )


def _pending_payments(*, user: User) -> QuerySet[SubscriptionPayment]:
    return SubscriptionPayment.objects.filter(
        user=user, plan=Plan.STANDARD, status=PaymentStatus.PENDING
    )


def _stale_pending_payments(now: datetime) -> QuerySet[SubscriptionPayment]:
    return SubscriptionPayment.objects.filter(
        plan=Plan.STANDARD,
        status=PaymentStatus.PENDING,
        created_at__lt=now - PENDING_PAYMENT_TTL,
    )


def _due_subscription_profiles(now: datetime) -> QuerySet[BillingProfile]:
    return BillingProfile.objects.filter(
        plan=Plan.STANDARD,
        subscription_status__in=[
            SubscriptionStatus.ACTIVE,
            SubscriptionStatus.PAST_DUE,
        ],
        current_period_ends_at__lte=now,
    )


@transaction.atomic
def mark_payment_paid(
    payment: SubscriptionPayment, data: dict, *, expected_merchant_id: str | None = None
) -> None:
    payment = SubscriptionPayment.objects.select_for_update().get(pk=payment.pk)
    if payment.status == PaymentStatus.PAID:
        return
    order_info = data.get("OrderInfo", {})
    _validate_paid_payment_callback(
        payment=payment,
        data=data,
        order_info=order_info,
        expected_merchant_id=expected_merchant_id,
    )
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
    payment.failure_message = data.get("RtnMsg", "")[:256]
    payment.raw_response = data
    payment.save()


def _validate_paid_payment_callback(
    *,
    payment: SubscriptionPayment,
    data: dict,
    order_info: dict,
    expected_merchant_id: str | None,
) -> None:
    if data.get("RtnCode") != 1:
        raise SubscriptionPaymentValidationError("Payment callback is not successful")

    if (
        expected_merchant_id is not None
        and data.get("MerchantID") != expected_merchant_id
    ):
        raise SubscriptionPaymentValidationError("Payment merchant id mismatch")

    if order_info.get("MerchantTradeNo") != payment.provider_request_id:
        raise SubscriptionPaymentValidationError("Payment trade number mismatch")

    if not order_info.get("TradeNo"):
        raise SubscriptionPaymentValidationError(
            "Payment provider transaction id missing"
        )

    if (
        SubscriptionPayment.objects.filter(
            provider_transaction_id=order_info["TradeNo"], status=PaymentStatus.PAID
        )
        .exclude(pk=payment.pk)
        .exists()
    ):
        raise SubscriptionPaymentValidationError(
            "Payment provider transaction id already used"
        )

    callback_amount = order_info.get("TotalAmount")
    if callback_amount is None and expected_merchant_id is not None:
        raise SubscriptionPaymentValidationError("Payment amount missing")
    if callback_amount is None:
        return

    try:
        parsed_callback_amount = int(callback_amount)
    except (TypeError, ValueError) as error:
        raise SubscriptionPaymentValidationError("Payment amount is invalid") from error

    if parsed_callback_amount != payment.amount:
        raise SubscriptionPaymentValidationError("Payment amount mismatch")
