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
    PAST_DUE = "past_due", "Past due"
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


class CardStatus(models.TextChoices):
    PENDING = "pending", "Pending"
    ACTIVE = "active", "Active"
    FAILED = "failed", "Failed"
    DELETED = "deleted", "Deleted"


class PaymentProvider(models.TextChoices):
    ECPAY = "ecpay", "ECPay"


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
                            SubscriptionStatus.PAST_DUE,
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
                    ~models.Q(
                        subscription_status__in=[
                            SubscriptionStatus.ACTIVE,
                            SubscriptionStatus.PAST_DUE,
                        ]
                    )
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
                        & models.Q(
                            subscription_status__in=[
                                SubscriptionStatus.ACTIVE,
                                SubscriptionStatus.PAST_DUE,
                            ]
                        )
                    )
                ),
            ),
        ]


class CardBinding(CreateUpdateDateModel):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="card_bindings"
    )
    provider = models.CharField(
        max_length=32, choices=PaymentProvider.choices, default=PaymentProvider.ECPAY
    )
    provider_member_id = models.CharField(max_length=60)
    provider_request_id = models.CharField(max_length=64, unique=True)
    provider_binding_id = models.CharField(max_length=128, blank=True, null=True)
    card_6_no = models.CharField(max_length=6, blank=True, null=True)
    card_4_no = models.CharField(max_length=4, blank=True, null=True)
    status = models.CharField(
        max_length=16, choices=CardStatus.choices, default=CardStatus.PENDING
    )
    raw_response = models.JSONField(default=dict, blank=True)

    class Meta:
        db_table = "card_binding"
        indexes = [
            models.Index(
                fields=["user", "status", "provider", "-updated_at"],
                name="card_bind_default_idx",
            ),
        ]
        constraints = [
            models.CheckConstraint(
                name="card_bind_active_provider_id",
                condition=(
                    ~models.Q(status=CardStatus.ACTIVE)
                    | (
                        models.Q(provider_binding_id__isnull=False)
                        & ~models.Q(provider_binding_id="")
                    )
                ),
            )
        ]


class SubscriptionPayment(CreateUpdateDateModel):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="subscription_payments",
    )
    card_binding = models.ForeignKey(
        CardBinding, on_delete=models.PROTECT, related_name="subscription_payments"
    )
    provider_request_id = models.CharField(max_length=64, unique=True)
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

    class Meta:
        db_table = "subscription_payment"
        indexes = [
            models.Index(
                fields=["user", "plan", "status", "created_at"],
                name="sub_payment_inflight_idx",
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
            )
        ]
