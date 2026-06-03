from datetime import datetime, timedelta

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
from main.billing.services.ecpay import (
    EcpayClient,
    generate_merchant_trade_no,
    get_aio_order_result_url,
    get_aio_period_return_url,
    get_aio_return_url,
)
from main.billing.services.entitlements import (
    ensure_billing_profile,
    is_standard_subscription_active,
)

STANDARD_PRICES = {BillingInterval.MONTH: 65, BillingInterval.YEAR: 700}
STANDARD_CURRENCY = Currency.TWD
PENDING_PAYMENT_TTL = timedelta(minutes=30)
STALE_PAYMENT_FAILURE_MESSAGE = "Payment confirmation timed out"
SUPERSEDED_PAYMENT_FAILURE_MESSAGE = "Payment checkout was replaced"


class SubscriptionPaymentNotChargeableError(Exception):
    pass


class SubscriptionPaymentValidationError(Exception):
    pass


def create_subscription_checkout(
    *, user: User, interval: str, client: EcpayClient | None = None
) -> dict:
    payment = _create_pending_subscription_payment(user=user, interval=interval)
    ecpay_client = client or EcpayClient()
    form = ecpay_client.build_aio_periodic_checkout_form(
        user_id=user.id,
        merchant_trade_no=payment.provider_request_id,
        amount=payment.amount,
        billing_interval=payment.billing_interval,
        return_url=get_aio_return_url(),
        period_return_url=get_aio_period_return_url(),
        order_result_url=get_aio_order_result_url(),
    )
    payment.raw_response = form
    payment.save()
    return form


def expire_stale_pending_payments(*, now: datetime | None = None) -> int:
    now = now or timezone.now()
    return SubscriptionPayment.objects.filter(
        plan=Plan.STANDARD,
        status=PaymentStatus.PENDING,
        created_at__lt=now - PENDING_PAYMENT_TTL,
    ).update(
        status=PaymentStatus.EXPIRED,
        failure_message=STALE_PAYMENT_FAILURE_MESSAGE,
        updated_at=now,
    )


def reconcile_due_billing_profiles(*, now: datetime | None = None) -> int:
    now = now or timezone.now()
    canceled_subscription_count = BillingProfile.objects.filter(
        plan=Plan.STANDARD,
        subscription_status__in=[
            SubscriptionStatus.ACTIVE,
            SubscriptionStatus.PAST_DUE,
        ],
        current_period_ends_at__lte=now,
        cancel_at_period_end=True,
    ).update(
        plan=Plan.FREE,
        subscription_status=SubscriptionStatus.CANCELED,
        cancel_at_period_end=False,
        updated_at=now,
    )
    expired_trial_count = BillingProfile.objects.filter(
        plan=Plan.STANDARD,
        subscription_status=SubscriptionStatus.TRIALING,
        trial_ends_at__lte=now,
    ).update(
        plan=Plan.FREE, subscription_status=SubscriptionStatus.CANCELED, updated_at=now
    )
    return canceled_subscription_count + expired_trial_count


@transaction.atomic
def _create_pending_subscription_payment(
    *, user: User, interval: str
) -> SubscriptionPayment:
    if interval not in STANDARD_PRICES:
        raise ValueError("Unsupported billing interval")
    ensure_billing_profile(user)
    profile = BillingProfile.objects.select_for_update().get(user=user)
    if is_standard_subscription_active(profile):
        raise SubscriptionPaymentNotChargeableError("Subscription is already active")
    SubscriptionPayment.objects.filter(
        user=user, plan=Plan.STANDARD, status=PaymentStatus.PENDING
    ).update(
        status=PaymentStatus.EXPIRED,
        failure_message=SUPERSEDED_PAYMENT_FAILURE_MESSAGE,
        updated_at=timezone.now(),
    )
    return SubscriptionPayment.objects.create(
        user=user,
        provider_request_id=generate_merchant_trade_no("S"),
        provider_subscription_id=None,
        plan=Plan.STANDARD,
        billing_interval=interval,
        currency=STANDARD_CURRENCY,
        amount=STANDARD_PRICES[interval],
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
    payment.provider_subscription_id = (
        payment.provider_subscription_id or order_info.get("MerchantTradeNo")
    )
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
    if str(data.get("RtnCode")) != "1":
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


@transaction.atomic
def process_period_payment_callback(
    data: dict, *, expected_merchant_id: str | None = None
) -> SubscriptionPayment:
    original_trade_no = data.get("MerchantTradeNo")
    if not original_trade_no:
        raise SubscriptionPaymentValidationError("Period trade number missing")

    first_payment = (
        SubscriptionPayment.objects.select_related("user")
        .filter(provider_subscription_id=original_trade_no, status=PaymentStatus.PAID)
        .order_by("created_at")
        .first()
    )
    if first_payment is None:
        first_payment = (
            SubscriptionPayment.objects.select_related("user")
            .filter(provider_request_id=original_trade_no, status=PaymentStatus.PAID)
            .first()
        )
    if first_payment is None:
        raise SubscriptionPaymentValidationError(
            "Original subscription payment missing"
        )

    provider_transaction_id = str(data.get("Gwsr") or data.get("TradeNo") or "")
    if not provider_transaction_id:
        raise SubscriptionPaymentValidationError(
            "Period provider transaction id missing"
        )

    provider_request_id = _period_provider_request_id(
        original_trade_no=original_trade_no,
        total_success_times=data.get("TotalSuccessTimes"),
        provider_transaction_id=provider_transaction_id,
    )
    payment, _ = SubscriptionPayment.objects.select_for_update().get_or_create(
        provider_request_id=provider_request_id,
        defaults={
            "user": first_payment.user,
            "provider_subscription_id": original_trade_no,
            "plan": Plan.STANDARD,
            "billing_interval": first_payment.billing_interval,
            "currency": STANDARD_CURRENCY,
            "amount": int(data.get("Amount") or first_payment.amount),
        },
    )
    normalized = {
        **data,
        "OrderInfo": {
            "MerchantTradeNo": payment.provider_request_id,
            "TradeNo": provider_transaction_id,
            "TotalAmount": data.get("Amount"),
        },
    }
    if str(data.get("RtnCode")) == "1":
        mark_payment_paid(
            payment, normalized, expected_merchant_id=expected_merchant_id
        )
    else:
        mark_payment_failed(payment.provider_request_id, data)
        BillingProfile.objects.filter(user=first_payment.user).update(
            subscription_status=SubscriptionStatus.PAST_DUE, updated_at=timezone.now()
        )
    payment.refresh_from_db()
    return payment


def _period_provider_request_id(
    *, original_trade_no: str, total_success_times: object, provider_transaction_id: str
) -> str:
    suffix = str(total_success_times or provider_transaction_id)
    return f"{original_trade_no}P{suffix}"[:64]


def get_active_provider_subscription_id(user: User) -> str | None:
    payment = (
        SubscriptionPayment.objects.filter(
            user=user,
            plan=Plan.STANDARD,
            status=PaymentStatus.PAID,
            provider_subscription_id__isnull=False,
        )
        .order_by("-created_at")
        .first()
    )
    return payment.provider_subscription_id if payment else None


def _next_period_end(interval: str) -> datetime:
    now = timezone.now()
    if interval == BillingInterval.YEAR:
        return now + relativedelta(years=1)
    return now + relativedelta(months=1)
