from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

import pytest
from _pytest.monkeypatch import MonkeyPatch
from django.utils import timezone

from main.account import OAuthOrganization
from main.account.models import User
from main.billing.models import (
    BillingInterval,
    BillingProfile,
    PaymentStatus,
    Plan,
    SubscriptionPayment,
    SubscriptionStatus,
)
from main.billing.services.subscription import (
    STALE_PAYMENT_FAILURE_MESSAGE,
    SUPERSEDED_PAYMENT_FAILURE_MESSAGE,
    SubscriptionPaymentNotChargeableError,
    SubscriptionPaymentValidationError,
    _next_period_end,
    create_subscription_checkout,
    expire_stale_pending_payments,
    mark_payment_paid,
    reconcile_due_billing_profiles,
)


class FakeEcpayClient:
    def __init__(self) -> None:
        self.calls = 0

    def build_aio_periodic_checkout_form(self, **kwargs) -> dict:  # noqa: ANN003
        self.calls += 1
        return {
            "action_url": "https://payment-stage.ecpay.com.tw/Cashier/AioCheckOut/V5",
            "params": {
                "MerchantTradeNo": kwargs["merchant_trade_no"],
                "TotalAmount": kwargs["amount"],
            },
        }


def test_next_period_end_uses_calendar_month(monkeypatch: MonkeyPatch) -> None:
    fixed_now = datetime(2024, 1, 31, 10, 0, tzinfo=ZoneInfo("Asia/Taipei"))
    monkeypatch.setattr(
        "main.billing.services.subscription.timezone.now", lambda: fixed_now
    )

    period_end = _next_period_end(BillingInterval.MONTH)

    assert period_end == datetime(2024, 2, 29, 10, 0, tzinfo=ZoneInfo("Asia/Taipei"))


def test_next_period_end_uses_calendar_year(monkeypatch: MonkeyPatch) -> None:
    fixed_now = datetime(2024, 2, 29, 10, 0, tzinfo=ZoneInfo("Asia/Taipei"))
    monkeypatch.setattr(
        "main.billing.services.subscription.timezone.now", lambda: fixed_now
    )

    period_end = _next_period_end(BillingInterval.YEAR)

    assert period_end == datetime(2025, 2, 28, 10, 0, tzinfo=ZoneInfo("Asia/Taipei"))


@pytest.mark.django_db
class TestDueBillingProfileReconciliation:
    @pytest.fixture
    def user(self) -> User:
        return User.objects.create_user(
            oauth_org=OAuthOrganization.GOOGLE,
            oauth_id="oauth-id",
            email="test@example.com",
            username="Test User",
        )

    def test_due_active_subscription_waits_for_ecpay_period_callback(
        self, user: User
    ) -> None:
        due_at = timezone.now() - timedelta(minutes=1)
        BillingProfile.objects.create(
            user=user,
            plan=Plan.STANDARD,
            subscription_status=SubscriptionStatus.ACTIVE,
            billing_interval=BillingInterval.MONTH,
            current_period_started_at=due_at - timedelta(days=31),
            current_period_ends_at=due_at,
        )
        canceled_count = reconcile_due_billing_profiles()

        profile = BillingProfile.objects.get(user=user)
        assert canceled_count == 0
        assert profile.subscription_status == SubscriptionStatus.ACTIVE
        assert profile.current_period_ends_at == due_at

    def test_cancel_at_period_end_downgrades_without_charging(self, user: User) -> None:
        due_at = timezone.now() - timedelta(minutes=1)
        BillingProfile.objects.create(
            user=user,
            plan=Plan.STANDARD,
            subscription_status=SubscriptionStatus.ACTIVE,
            billing_interval=BillingInterval.MONTH,
            current_period_started_at=due_at - timedelta(days=31),
            current_period_ends_at=due_at,
            cancel_at_period_end=True,
        )

        canceled_count = reconcile_due_billing_profiles()

        profile = BillingProfile.objects.get(user=user)
        assert canceled_count == 1
        assert profile.plan == Plan.FREE
        assert profile.subscription_status == SubscriptionStatus.CANCELED

    def test_expires_stale_pending_payments(self, user: User) -> None:
        payment = SubscriptionPayment.objects.create(
            user=user,
            provider_request_id="S123",
            plan=Plan.STANDARD,
            billing_interval=BillingInterval.MONTH,
            amount=65,
            status=PaymentStatus.PENDING,
        )
        SubscriptionPayment.objects.filter(pk=payment.pk).update(
            created_at=timezone.now() - timedelta(minutes=31)
        )

        expired_count = expire_stale_pending_payments()

        payment.refresh_from_db()
        assert expired_count == 1
        assert payment.status == PaymentStatus.EXPIRED
        assert payment.failure_message == STALE_PAYMENT_FAILURE_MESSAGE


@pytest.mark.django_db
class TestSubscriptionPaymentLifecycle:
    @pytest.fixture
    def user(self) -> User:
        return User.objects.create_user(
            oauth_org=OAuthOrganization.GOOGLE,
            oauth_id="oauth-id",
            email="test@example.com",
            username="Test User",
        )

    def test_replaces_existing_pending_payment_with_new_checkout(
        self, user: User
    ) -> None:
        existing_payment = SubscriptionPayment.objects.create(
            user=user,
            provider_request_id="S123",
            plan=Plan.STANDARD,
            billing_interval=BillingInterval.MONTH,
            amount=65,
            status=PaymentStatus.PENDING,
            raw_response={
                "action_url": "https://payment-stage.ecpay.com.tw/Cashier/AioCheckOut/V5",
                "params": {"MerchantTradeNo": "S123", "TotalAmount": 65},
            },
        )
        client = FakeEcpayClient()

        checkout = create_subscription_checkout(
            user=user, interval=BillingInterval.MONTH, client=client
        )
        existing_payment.refresh_from_db()
        new_payment = SubscriptionPayment.objects.get(
            provider_request_id=checkout["params"]["MerchantTradeNo"]
        )

        assert (
            checkout["params"]["MerchantTradeNo"]
            != existing_payment.provider_request_id
        )
        assert existing_payment.status == PaymentStatus.EXPIRED
        assert existing_payment.failure_message == SUPERSEDED_PAYMENT_FAILURE_MESSAGE
        assert new_payment.status == PaymentStatus.PENDING
        assert client.calls == 1
        assert (
            SubscriptionPayment.objects.filter(
                user=user, status=PaymentStatus.PENDING
            ).count()
            == 1
        )

    def test_active_subscription_cannot_be_started_again(self, user: User) -> None:
        BillingProfile.objects.create(
            user=user,
            plan=Plan.STANDARD,
            subscription_status=SubscriptionStatus.ACTIVE,
            billing_interval=BillingInterval.MONTH,
            current_period_started_at=timezone.now() - timedelta(days=1),
            current_period_ends_at=timezone.now() + timedelta(days=29),
        )
        client = FakeEcpayClient()

        with pytest.raises(
            SubscriptionPaymentNotChargeableError,
            match="Subscription is already active",
        ):
            create_subscription_checkout(
                user=user, interval=BillingInterval.MONTH, client=client
            )

        assert client.calls == 0
        assert not SubscriptionPayment.objects.filter(user=user).exists()

    def test_expires_stale_pending_payment_before_creating_new_payment(
        self, user: User
    ) -> None:
        stale_payment = SubscriptionPayment.objects.create(
            user=user,
            provider_request_id="S123",
            plan=Plan.STANDARD,
            billing_interval=BillingInterval.MONTH,
            amount=65,
            status=PaymentStatus.PENDING,
        )
        SubscriptionPayment.objects.filter(pk=stale_payment.pk).update(
            created_at=timezone.now() - timedelta(minutes=31)
        )
        client = FakeEcpayClient()

        checkout = create_subscription_checkout(
            user=user, interval=BillingInterval.MONTH, client=client
        )

        stale_payment.refresh_from_db()
        payment = SubscriptionPayment.objects.get(
            provider_request_id=checkout["params"]["MerchantTradeNo"]
        )
        assert stale_payment.status == PaymentStatus.EXPIRED
        assert payment.pk != stale_payment.pk
        assert payment.status == PaymentStatus.PENDING
        assert client.calls == 1

    def test_late_success_callback_can_mark_expired_payment_paid(
        self, user: User
    ) -> None:
        payment = SubscriptionPayment.objects.create(
            user=user,
            provider_request_id="S123",
            plan=Plan.STANDARD,
            billing_interval=BillingInterval.MONTH,
            amount=65,
            status=PaymentStatus.PENDING,
        )
        SubscriptionPayment.objects.filter(pk=payment.pk).update(
            created_at=timezone.now() - timedelta(minutes=31)
        )
        assert expire_stale_pending_payments() == 1
        payment.refresh_from_db()
        assert payment.status == PaymentStatus.EXPIRED

        mark_payment_paid(
            payment,
            {
                "RtnCode": 1,
                "OrderInfo": {
                    "MerchantTradeNo": payment.provider_request_id,
                    "TradeNo": "ecpay-trade-no",
                    "TotalAmount": payment.amount,
                },
            },
        )

        payment.refresh_from_db()
        assert payment.status == PaymentStatus.PAID
        assert payment.provider_transaction_id == "ecpay-trade-no"

    def test_success_callback_rejects_amount_mismatch(self, user: User) -> None:
        payment = SubscriptionPayment.objects.create(
            user=user,
            provider_request_id="S123",
            plan=Plan.STANDARD,
            billing_interval=BillingInterval.MONTH,
            amount=65,
            status=PaymentStatus.PENDING,
        )

        with pytest.raises(
            SubscriptionPaymentValidationError, match="Payment amount mismatch"
        ):
            mark_payment_paid(
                payment,
                {
                    "RtnCode": 1,
                    "OrderInfo": {
                        "MerchantTradeNo": payment.provider_request_id,
                        "TradeNo": "ecpay-trade-no",
                        "TotalAmount": 700,
                    },
                },
            )

        payment.refresh_from_db()
        assert payment.status == PaymentStatus.PENDING

    def test_success_callback_rejects_merchant_mismatch(self, user: User) -> None:
        payment = SubscriptionPayment.objects.create(
            user=user,
            provider_request_id="S123",
            plan=Plan.STANDARD,
            billing_interval=BillingInterval.MONTH,
            amount=65,
            status=PaymentStatus.PENDING,
        )

        with pytest.raises(
            SubscriptionPaymentValidationError, match="Payment merchant id mismatch"
        ):
            mark_payment_paid(
                payment,
                {
                    "MerchantID": "unexpected-merchant",
                    "RtnCode": 1,
                    "OrderInfo": {
                        "MerchantTradeNo": payment.provider_request_id,
                        "TradeNo": "ecpay-trade-no",
                        "TotalAmount": payment.amount,
                    },
                },
                expected_merchant_id="expected-merchant",
            )

        payment.refresh_from_db()
        assert payment.status == PaymentStatus.PENDING

    def test_success_callback_rejects_duplicate_provider_transaction_id(
        self, user: User
    ) -> None:
        SubscriptionPayment.objects.create(
            user=user,
            provider_request_id="S122",
            provider_transaction_id="ecpay-trade-no",
            plan=Plan.STANDARD,
            billing_interval=BillingInterval.MONTH,
            amount=65,
            status=PaymentStatus.PAID,
            paid_at=timezone.now(),
        )
        payment = SubscriptionPayment.objects.create(
            user=user,
            provider_request_id="S123",
            plan=Plan.STANDARD,
            billing_interval=BillingInterval.MONTH,
            amount=65,
            status=PaymentStatus.PENDING,
        )

        with pytest.raises(
            SubscriptionPaymentValidationError,
            match="Payment provider transaction id already used",
        ):
            mark_payment_paid(
                payment,
                {
                    "RtnCode": 1,
                    "OrderInfo": {
                        "MerchantTradeNo": payment.provider_request_id,
                        "TradeNo": "ecpay-trade-no",
                        "TotalAmount": payment.amount,
                    },
                },
            )

        payment.refresh_from_db()
        assert payment.status == PaymentStatus.PENDING
