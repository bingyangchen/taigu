import uuid

from django.conf import settings
from django.db import models

from main.core.models import CreateUpdateDateModel


class Plan(models.TextChoices):
    FREE = "free", "Free"
    STANDARD = "standard", "Standard"


class SubscriptionStatus(models.TextChoices):
    TRIALING = "trialing", "Trialing"
    ACTIVE = "active", "Active"
    CANCELED = "canceled", "Canceled"


class BillingInterval(models.TextChoices):
    MONTH = "month", "Month"
    YEAR = "year", "Year"


class Currency(models.TextChoices):
    TWD = "TWD", "TWD"


class PaymentStatus(models.TextChoices):
    PENDING = "pending", "Pending"
    PAID = "paid", "Paid"
    FAILED = "failed", "Failed"
    EXPIRED = "expired", "Expired"


class BillingProfile(CreateUpdateDateModel):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="billing_profile",
    )
    plan = models.CharField(max_length=16, choices=Plan.choices, default=Plan.STANDARD)
    subscription_status = models.CharField(
        max_length=16,
        choices=SubscriptionStatus.choices,
        default=SubscriptionStatus.TRIALING,
    )
    billing_interval = models.CharField(
        max_length=16, choices=BillingInterval.choices, default=BillingInterval.MONTH
    )
    trial_started_at = models.DateTimeField(blank=True, null=True)
    trial_ends_at = models.DateTimeField(blank=True, null=True)
    current_period_started_at = models.DateTimeField(blank=True, null=True)
    current_period_ends_at = models.DateTimeField(blank=True, null=True)
    cancel_at_period_end = models.BooleanField(default=False)

    # The payment that made the subscription auto-renewing. Its ECPay periodic order
    # is the subscription's own (BILL-R27), and its paid_at anchors the end of every
    # period (BILL-R14).
    initial_payment = models.ForeignKey(
        "SubscriptionPayment",
        on_delete=models.SET_NULL,
        related_name="+",
        blank=True,
        null=True,
    )

    # Whether the last subscription ended because a period went unpaid (BILL-R22),
    # with no subscription since.
    ended_by_failed_renewal = models.BooleanField(default=False, db_default=False)

    class Meta:
        db_table = "billing_profile"
        indexes = [
            models.Index(
                fields=["plan", "subscription_status", "current_period_ends_at"],
                name="billing_profile_due_idx",
            ),
            models.Index(
                fields=["plan", "subscription_status", "trial_ends_at"],
                name="billing_profile_trial_idx",
            ),
        ]
        constraints = [
            models.CheckConstraint(
                name="billing_profile_plan_subscription_status_valid",
                condition=(
                    models.Q(plan=Plan.FREE)
                    & models.Q(subscription_status=SubscriptionStatus.CANCELED)
                )
                | (
                    models.Q(plan=Plan.STANDARD)
                    & models.Q(
                        subscription_status__in=[
                            SubscriptionStatus.TRIALING,
                            SubscriptionStatus.ACTIVE,
                        ]
                    )
                ),
            ),
            models.CheckConstraint(
                name="billing_profile_trial_dates",
                condition=(
                    ~models.Q(subscription_status=SubscriptionStatus.TRIALING)
                    | (
                        models.Q(trial_started_at__isnull=False)
                        & models.Q(trial_ends_at__isnull=False)
                    )
                ),
            ),
            models.CheckConstraint(
                name="billing_profile_period_dates",
                condition=(
                    ~models.Q(subscription_status=SubscriptionStatus.ACTIVE)
                    | (
                        models.Q(current_period_started_at__isnull=False)
                        & models.Q(current_period_ends_at__isnull=False)
                    )
                ),
            ),
            models.CheckConstraint(
                name="billing_profile_cancel_flag",
                condition=(
                    models.Q(cancel_at_period_end=False)
                    | (
                        models.Q(plan=Plan.STANDARD)
                        & models.Q(subscription_status=SubscriptionStatus.ACTIVE)
                    )
                ),
            ),
        ]


class StandardWhitelist(CreateUpdateDateModel):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="standard_whitelist",
    )
    note = models.CharField(max_length=256, blank=True)

    class Meta:
        db_table = "standard_whitelist"


class SubscriptionPayment(CreateUpdateDateModel):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="subscription_payments",
    )

    # ECPay MerchantTradeNo of this charge. Recurring charges have none of their
    # own, so it is derived as `<first charge's MerchantTradeNo>P<n>`.
    provider_request_id = models.CharField(max_length=64, unique=True)

    # MerchantTradeNo of the subscription's first charge, shared by all of its
    # recurring charges and used to cancel the ECPay periodic order.
    provider_subscription_id = models.CharField(max_length=64, blank=True, null=True)

    # ECPay's own transaction number (TradeNo, or Gwsr for a recurring charge),
    # set once the charge is paid.
    provider_transaction_id = models.CharField(max_length=128, blank=True, null=True)

    plan = models.CharField(max_length=16, choices=Plan.choices, default=Plan.STANDARD)
    billing_interval = models.CharField(max_length=16, choices=BillingInterval.choices)
    currency = models.CharField(
        max_length=3, choices=Currency.choices, default=Currency.TWD
    )
    amount = models.PositiveIntegerField()
    status = models.CharField(
        max_length=16, choices=PaymentStatus.choices, default=PaymentStatus.PENDING
    )
    paid_at = models.DateTimeField(blank=True, null=True)
    failure_message = models.CharField(max_length=256, blank=True)
    raw_response = models.JSONField(default=dict, blank=True)

    # Set when another payment succeeds while the subscription is auto-renewing.
    # Cleared once this payment's ECPay periodic order is terminated (BILL-R27).
    provider_subscription_termination_pending = models.BooleanField(
        default=False, db_default=False
    )

    class Meta:
        db_table = "subscription_payment"
        indexes = [
            models.Index(
                fields=["user", "plan", "status", "created_at"],
                name="sub_payment_inflight_idx",
            ),
            models.Index(
                fields=["user", "provider_subscription_id", "-created_at"],
                name="sub_payment_subscription_idx",
            ),
            models.Index(
                fields=["provider_subscription_termination_pending"],
                condition=models.Q(provider_subscription_termination_pending=True),
                name="sub_payment_termination_idx",
            ),
        ]
        constraints = [
            models.CheckConstraint(
                name="sub_payment_paid_fields",
                condition=(
                    ~models.Q(status=PaymentStatus.PAID)
                    | (
                        models.Q(provider_transaction_id__isnull=False)
                        & ~models.Q(provider_transaction_id="")
                        & models.Q(paid_at__isnull=False)
                    )
                ),
            ),
            models.UniqueConstraint(
                fields=["user"],
                condition=models.Q(status=PaymentStatus.PENDING),
                name="unique_pending_subscription_payment_per_user",
            ),
        ]
