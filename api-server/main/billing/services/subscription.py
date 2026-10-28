import logging
import uuid
from datetime import datetime, timedelta

from django.db import transaction
from django.db.models import Q
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
    EcpayApiError,
    EcpayClient,
    generate_merchant_trade_no,
    get_aio_order_result_url,
    get_aio_period_return_url,
    get_aio_return_url,
)
from main.billing.services.entitlements import (
    ensure_billing_profile,
    is_auto_renewing,
    is_awaiting_renewal,
    is_standard_subscription_active,
    is_standard_whitelisted,
)
from main.billing.services.periods import get_next_period_end, get_period_end

logger = logging.getLogger(__name__)

STANDARD_PRICES = {BillingInterval.MONTH: 65, BillingInterval.YEAR: 700}
STANDARD_CURRENCY = Currency.TWD
PENDING_PAYMENT_TTL = timedelta(minutes=30)
STALE_PAYMENT_FAILURE_MESSAGE = "Payment confirmation timed out"
SUPERSEDED_PAYMENT_FAILURE_MESSAGE = "Payment checkout was replaced"
_PROVIDER_REQUEST_ID_MAX_LENGTH = SubscriptionPayment._meta.get_field(
    "provider_request_id"
).max_length


class SubscriptionPaymentNotChargeableError(Exception):
    pass


class SubscriptionPaymentValidationError(Exception):
    pass


class SubscriptionNotRenewingError(Exception):
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
    today_start = timezone.localtime(now).replace(
        hour=0, minute=0, second=0, microsecond=0
    )
    awaiting_profile_ids = list(
        BillingProfile.objects.filter(
            plan=Plan.STANDARD,
            subscription_status=SubscriptionStatus.ACTIVE,
            cancel_at_period_end=False,
            current_period_ends_at__lt=today_start,
        ).values_list("pk", flat=True)
    )
    settled_renewal_count = 0
    for profile_id in awaiting_profile_ids:
        try:
            _settle_renewal(profile_id, now=now)
        except EcpayApiError:
            logger.warning(
                "Failed to settle the renewal of billing profile %s",
                profile_id,
                exc_info=True,
            )
            continue
        except Exception:
            logger.exception(
                "Failed to settle the renewal of billing profile %s", profile_id
            )
            continue
        settled_renewal_count += 1
    canceled_subscription_count = BillingProfile.objects.filter(
        plan=Plan.STANDARD,
        subscription_status=SubscriptionStatus.ACTIVE,
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
    return settled_renewal_count + canceled_subscription_count + expired_trial_count


def terminate_pending_provider_subscriptions() -> int:
    payment_ids = list(
        SubscriptionPayment.objects.filter(
            provider_subscription_termination_pending=True
        ).values_list("pk", flat=True)
    )
    return sum(
        _terminate_extra_provider_subscription(payment_id) for payment_id in payment_ids
    )


def stop_auto_renewal(user: User) -> None:
    now = timezone.now()
    ensure_billing_profile(user)
    profile = BillingProfile.objects.select_related("initial_payment").get(user=user)
    if (
        profile.subscription_status == SubscriptionStatus.ACTIVE
        and profile.cancel_at_period_end
        and profile.current_period_ends_at > now
    ):
        return
    if not is_auto_renewing(profile):
        raise SubscriptionNotRenewingError("No active subscription to cancel")

    initial_payment = _get_initial_payment(profile)
    ecpay_client = EcpayClient()
    unrecorded_charge = (
        _query_unrecorded_charge(initial_payment, client=ecpay_client)
        if is_awaiting_renewal(profile, now=now)
        else None
    )
    ecpay_client.cancel_aio_periodic_order(
        merchant_trade_no=initial_payment.provider_subscription_id
    )
    with transaction.atomic():
        if unrecorded_charge is not None:
            _record_period_charge(initial_payment, unrecorded_charge)
        profile = BillingProfile.objects.select_for_update().get(pk=profile.pk)
        if not is_auto_renewing(profile):
            return
        if profile.current_period_ends_at > timezone.now():
            profile.cancel_at_period_end = True
        else:
            profile.plan = Plan.FREE
            profile.subscription_status = SubscriptionStatus.CANCELED
        profile.save()


def _settle_renewal(profile_id: int, *, now: datetime) -> None:
    profile = BillingProfile.objects.select_related("initial_payment").get(
        pk=profile_id
    )
    if not is_awaiting_renewal(profile, now=now):
        return
    initial_payment = _get_initial_payment(profile)
    ecpay_client = EcpayClient()
    unrecorded_charge = _query_unrecorded_charge(initial_payment, client=ecpay_client)
    if unrecorded_charge is not None:
        _record_period_charge(initial_payment, unrecorded_charge)
        return

    ecpay_client.cancel_aio_periodic_order(
        merchant_trade_no=initial_payment.provider_subscription_id
    )
    with transaction.atomic():
        profile = BillingProfile.objects.select_for_update().get(pk=profile_id)
        if is_awaiting_renewal(profile, now=now):
            profile.plan = Plan.FREE
            profile.subscription_status = SubscriptionStatus.CANCELED
            profile.ended_by_failed_renewal = True
            profile.save()
        elif is_auto_renewing(profile):
            # A charge was recorded after the query, so this period is paid, but the
            # periodic order is terminated now and will not charge again.
            profile.cancel_at_period_end = True
            profile.save()


def _get_initial_payment(profile: BillingProfile) -> SubscriptionPayment:
    if profile.initial_payment is None:
        raise ValueError(
            f"Auto-renewing billing profile {profile.pk} has no initial payment"
        )
    return profile.initial_payment


def _query_unrecorded_charge(
    first_payment: SubscriptionPayment, *, client: EcpayClient
) -> dict | None:
    """
    Returns the latest successful charge of the payment's ECPay periodic order, in
    the shape of a PeriodReturnURL callback, if the backend has not recorded it.
    """
    periodic_order = client.query_aio_periodic_order(
        merchant_trade_no=first_payment.provider_subscription_id
    )
    charge = periodic_order.latest_successful_charge

    # The first success is the order's first charge, which started the subscription.
    if periodic_order.total_success_times <= 1 or charge is None:
        return None

    provider_request_id = _make_period_provider_request_id(
        original_trade_no=first_payment.provider_subscription_id,
        total_success_times=periodic_order.total_success_times,
        provider_transaction_id=charge.gwsr,
    )

    # A callback keys a charge by its TotalSuccessTimes and records its Gwsr, or its
    # TradeNo when Gwsr is missing, so any of the three shows the charge is recorded.
    if SubscriptionPayment.objects.filter(
        Q(provider_request_id=provider_request_id)
        | Q(
            provider_subscription_id=first_payment.provider_subscription_id,
            provider_transaction_id__in=[
                charge.gwsr,
                str(charge.exec_log_entry.get("TradeNo")),
            ],
        ),
        status=PaymentStatus.PAID,
    ).exists():
        return None
    return {
        **charge.exec_log_entry,
        "TotalSuccessTimes": periodic_order.total_success_times,
        "OrderInfo": {
            "MerchantTradeNo": provider_request_id,
            "TradeNo": charge.gwsr,
            "TotalAmount": charge.amount,
        },
    }


def _terminate_extra_provider_subscription(payment_id: uuid.UUID) -> bool:
    payment = SubscriptionPayment.objects.get(pk=payment_id)
    try:
        EcpayClient().cancel_aio_periodic_order(
            merchant_trade_no=payment.provider_subscription_id
        )
    except EcpayApiError:
        logger.warning(
            "Failed to terminate the ECPay periodic order %s",
            payment.provider_subscription_id,
            exc_info=True,
        )
        return False
    SubscriptionPayment.objects.filter(pk=payment_id).update(
        provider_subscription_termination_pending=False, updated_at=timezone.now()
    )
    return True


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
    if is_standard_whitelisted(user):
        raise SubscriptionPaymentNotChargeableError("User is on the Standard whitelist")
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


def mark_payment_paid(
    payment: SubscriptionPayment, data: dict, *, expected_merchant_id: str | None = None
) -> None:
    if _record_payment_paid(payment, data, expected_merchant_id=expected_merchant_id):
        _terminate_extra_provider_subscription(payment.pk)


@transaction.atomic
def _record_payment_paid(
    payment: SubscriptionPayment, data: dict, *, expected_merchant_id: str | None
) -> bool:
    """
    Returns whether the payment's ECPay periodic order must be terminated, because
    the subscription was already auto-renewing (BILL-R27).
    """
    ensure_billing_profile(payment.user)
    profile = BillingProfile.objects.select_for_update().get(user=payment.user)
    payment = SubscriptionPayment.objects.select_for_update().get(pk=payment.pk)
    if payment.status == PaymentStatus.PAID:
        return False
    _mark_paid(payment, data, expected_merchant_id=expected_merchant_id)
    payment.provider_subscription_id = payment.provider_subscription_id or data.get(
        "OrderInfo", {}
    ).get("MerchantTradeNo")
    if is_auto_renewing(profile):
        payment.provider_subscription_termination_pending = True
        payment.save()
        return True
    payment.save()

    profile.plan = Plan.STANDARD
    profile.subscription_status = SubscriptionStatus.ACTIVE
    profile.billing_interval = payment.billing_interval
    profile.initial_payment = payment
    profile.current_period_started_at = payment.paid_at
    profile.current_period_ends_at = get_period_end(
        payment.paid_at, payment.billing_interval, 1
    )
    profile.cancel_at_period_end = False
    profile.ended_by_failed_renewal = False
    profile.save()
    return False


@transaction.atomic
def mark_payment_failed(provider_request_id: str, data: dict) -> None:
    payment = SubscriptionPayment.objects.select_for_update().get(
        provider_request_id=provider_request_id
    )
    if payment.status == PaymentStatus.PAID:
        return
    payment.status = PaymentStatus.FAILED
    payment.failure_message = data.get("RtnMsg", "")[:256]
    payment.raw_response = data
    payment.save()


def _mark_paid(
    payment: SubscriptionPayment, data: dict, *, expected_merchant_id: str | None
) -> None:
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


def process_period_payment_callback(
    data: dict, *, expected_merchant_id: str | None = None
) -> None:
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

    if str(data.get("RtnCode")) != "1":
        _record_period_charge_failure(
            first_payment, provider_transaction_id=provider_transaction_id, data=data
        )
        return

    _record_period_charge(
        first_payment,
        {
            **data,
            "OrderInfo": {
                "MerchantTradeNo": _make_period_provider_request_id(
                    original_trade_no=original_trade_no,
                    total_success_times=data.get("TotalSuccessTimes"),
                    provider_transaction_id=provider_transaction_id,
                ),
                "TradeNo": provider_transaction_id,
                "TotalAmount": data.get("Amount"),
            },
        },
        expected_merchant_id=expected_merchant_id,
    )


@transaction.atomic
def _record_period_charge(
    first_payment: SubscriptionPayment,
    data: dict,
    *,
    expected_merchant_id: str | None = None,
) -> None:
    order_info = data["OrderInfo"]
    profile = BillingProfile.objects.select_for_update().get(user=first_payment.user)
    payment = (
        SubscriptionPayment.objects.select_for_update()
        .filter(provider_request_id=order_info["MerchantTradeNo"])
        .first()
    )
    if payment is not None and payment.status == PaymentStatus.PAID:
        return
    if payment is None:
        payment = SubscriptionPayment(
            user=first_payment.user,
            provider_request_id=order_info["MerchantTradeNo"],
            provider_subscription_id=first_payment.provider_subscription_id,
            plan=Plan.STANDARD,
            billing_interval=first_payment.billing_interval,
            currency=STANDARD_CURRENCY,
            amount=int(order_info.get("TotalAmount") or first_payment.amount),
        )
    _mark_paid(payment, data, expected_merchant_id=expected_merchant_id)
    payment.save()

    if profile.initial_payment_id == first_payment.pk and is_auto_renewing(profile):
        profile.current_period_started_at = profile.current_period_ends_at
        profile.current_period_ends_at = get_next_period_end(profile)
        profile.save()


def _record_period_charge_failure(
    first_payment: SubscriptionPayment, *, provider_transaction_id: str, data: dict
) -> None:
    SubscriptionPayment.objects.get_or_create(
        provider_request_id=_make_period_failure_provider_request_id(
            original_trade_no=first_payment.provider_subscription_id,
            provider_transaction_id=provider_transaction_id,
        ),
        defaults={
            "user": first_payment.user,
            "provider_subscription_id": first_payment.provider_subscription_id,
            "plan": Plan.STANDARD,
            "billing_interval": first_payment.billing_interval,
            "currency": STANDARD_CURRENCY,
            "amount": int(data.get("Amount") or first_payment.amount),
            "status": PaymentStatus.FAILED,
            "failure_message": data.get("RtnMsg", "")[:256],
            "raw_response": data,
        },
    )


def _make_period_provider_request_id(
    *, original_trade_no: str, total_success_times: object, provider_transaction_id: str
) -> str:
    suffix = str(total_success_times or provider_transaction_id)
    return f"{original_trade_no}P{suffix}"[:_PROVIDER_REQUEST_ID_MAX_LENGTH]


def _make_period_failure_provider_request_id(
    *, original_trade_no: str, provider_transaction_id: str
) -> str:
    # Keyed apart from the successful charges, whose key holds TotalSuccessTimes,
    # which a failed charge does not advance.
    return f"{original_trade_no}F{provider_transaction_id}"[
        :_PROVIDER_REQUEST_ID_MAX_LENGTH
    ]
