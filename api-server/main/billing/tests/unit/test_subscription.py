import threading
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

import pytest
from _pytest.monkeypatch import MonkeyPatch
from django.db import connection
from django.utils import timezone

from main.account import OAuthOrganization
from main.account.models import User
from main.billing.models import (
    BillingInterval,
    BillingProfile,
    CardBinding,
    CardStatus,
    PaymentProvider,
    PaymentStatus,
    Plan,
    SubscriptionPayment,
    SubscriptionStatus,
)
from main.billing.services.subscription import (
    STALE_PAYMENT_FAILURE_MESSAGE,
    SubscriptionPaymentNotChargeableError,
    _next_period_end,
    create_subscription_payment,
    expire_all_stale_pending_payments,
    mark_payment_paid,
    renew_due_subscriptions,
)


class FakeEcpayClient:
    def __init__(self) -> None:
        self.calls = 0

    def create_payment_with_card_id(self, **kwargs) -> dict:  # noqa: ANN003
        self.calls += 1
        return {
            "RtnCode": 1,
            "RtnMsg": "Succeeded",
            "OrderInfo": {
                "MerchantTradeNo": kwargs["merchant_trade_no"],
                "TradeNo": "ecpay-trade-no",
            },
        }


class BlockingEcpayClient(FakeEcpayClient):
    def __init__(self) -> None:
        super().__init__()
        self.started = threading.Event()
        self.release = threading.Event()

    def create_payment_with_card_id(self, **kwargs) -> dict:  # noqa: ANN003
        self.started.set()
        assert self.release.wait(timeout=5)
        return super().create_payment_with_card_id(**kwargs)


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
class TestRenewSubscriptions:
    @pytest.fixture
    def user(self) -> User:
        return User.objects.create_user(
            oauth_org=OAuthOrganization.GOOGLE,
            oauth_id="oauth-id",
            email="test@example.com",
            username="Test User",
        )

    def test_renews_due_active_subscription(self, user: User) -> None:
        due_at = timezone.now() - timedelta(minutes=1)
        BillingProfile.objects.create(
            user=user,
            plan=Plan.STANDARD,
            subscription_status=SubscriptionStatus.ACTIVE,
            billing_interval=BillingInterval.MONTH,
            current_period_started_at=due_at - timedelta(days=31),
            current_period_ends_at=due_at,
        )
        CardBinding.objects.create(
            user=user,
            provider=PaymentProvider.ECPAY,
            provider_member_id="member",
            provider_request_id="B123",
            provider_binding_id="bind-card-id",
            status=CardStatus.ACTIVE,
        )

        summary = renew_due_subscriptions(client=FakeEcpayClient())

        profile = BillingProfile.objects.get(user=user)
        assert summary == {"renewed": 1, "past_due": 0, "canceled": 0}
        assert profile.subscription_status == SubscriptionStatus.ACTIVE
        assert profile.current_period_ends_at > timezone.now()

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

        summary = renew_due_subscriptions(client=FakeEcpayClient())

        profile = BillingProfile.objects.get(user=user)
        assert summary == {"renewed": 0, "past_due": 0, "canceled": 1}
        assert profile.plan == Plan.FREE
        assert profile.subscription_status == SubscriptionStatus.CANCELED

    @pytest.mark.django_db(transaction=True)
    def test_concurrent_renewal_skips_payment_in_flight(self, user: User) -> None:
        due_at = timezone.now() - timedelta(minutes=1)
        BillingProfile.objects.create(
            user=user,
            plan=Plan.STANDARD,
            subscription_status=SubscriptionStatus.ACTIVE,
            billing_interval=BillingInterval.MONTH,
            current_period_started_at=due_at - timedelta(days=31),
            current_period_ends_at=due_at,
        )
        CardBinding.objects.create(
            user=user,
            provider=PaymentProvider.ECPAY,
            provider_member_id="member",
            provider_request_id="B123",
            provider_binding_id="bind-card-id",
            status=CardStatus.ACTIVE,
        )
        client = BlockingEcpayClient()
        thread_summary: list[dict[str, int]] = []
        thread_error: list[BaseException] = []

        def renew_in_thread() -> None:
            try:
                thread_summary.append(renew_due_subscriptions(client=client))
            except BaseException as error:
                thread_error.append(error)
            finally:
                connection.close()

        thread = threading.Thread(target=renew_in_thread)
        thread.start()
        assert client.started.wait(timeout=5)

        concurrent_summary = renew_due_subscriptions(client=client)

        client.release.set()
        thread.join(timeout=5)

        assert not thread_error
        assert not thread.is_alive()
        assert thread_summary == [{"renewed": 1, "past_due": 0, "canceled": 0}]
        assert concurrent_summary == {"renewed": 0, "past_due": 0, "canceled": 0}
        assert client.calls == 1

    def test_renewal_expires_stale_pending_payments(self, user: User) -> None:
        card = CardBinding.objects.create(
            user=user,
            provider=PaymentProvider.ECPAY,
            provider_member_id="member",
            provider_request_id="B123",
            provider_binding_id="bind-card-id",
            status=CardStatus.ACTIVE,
        )
        payment = SubscriptionPayment.objects.create(
            user=user,
            card_binding=card,
            provider_request_id="S123",
            plan=Plan.STANDARD,
            billing_interval=BillingInterval.MONTH,
            amount=65,
            status=PaymentStatus.PENDING,
        )
        SubscriptionPayment.objects.filter(pk=payment.pk).update(
            created_at=timezone.now() - timedelta(minutes=31)
        )

        expired_count = expire_all_stale_pending_payments()

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

    @pytest.fixture
    def card(self, user: User) -> CardBinding:
        return CardBinding.objects.create(
            user=user,
            provider=PaymentProvider.ECPAY,
            provider_member_id="member",
            provider_request_id="B123",
            provider_binding_id="bind-card-id",
            status=CardStatus.ACTIVE,
        )

    def test_reuses_existing_pending_payment_without_charging_again(
        self, user: User, card: CardBinding
    ) -> None:
        existing_payment = SubscriptionPayment.objects.create(
            user=user,
            card_binding=card,
            provider_request_id="S123",
            plan=Plan.STANDARD,
            billing_interval=BillingInterval.MONTH,
            amount=65,
            status=PaymentStatus.PENDING,
        )
        client = FakeEcpayClient()

        payment = create_subscription_payment(
            user=user, interval=BillingInterval.MONTH, client=client
        )

        assert payment == existing_payment
        assert payment.status == PaymentStatus.PENDING
        assert client.calls == 0
        assert SubscriptionPayment.objects.filter(
            user=user, status=PaymentStatus.PENDING
        ).count() == 1

    def test_active_subscription_cannot_be_started_again(
        self, user: User, card: CardBinding
    ) -> None:
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
            create_subscription_payment(
                user=user, interval=BillingInterval.MONTH, client=client
            )

        assert client.calls == 0
        assert not SubscriptionPayment.objects.filter(user=user).exists()

    def test_expires_stale_pending_payment_before_creating_new_payment(
        self, user: User, card: CardBinding
    ) -> None:
        stale_payment = SubscriptionPayment.objects.create(
            user=user,
            card_binding=card,
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

        payment = create_subscription_payment(
            user=user, interval=BillingInterval.MONTH, client=client
        )

        stale_payment.refresh_from_db()
        assert stale_payment.status == PaymentStatus.EXPIRED
        assert payment.pk != stale_payment.pk
        assert payment.status == PaymentStatus.PAID
        assert client.calls == 1

    def test_late_success_callback_can_mark_expired_payment_paid(
        self, user: User, card: CardBinding
    ) -> None:
        payment = SubscriptionPayment.objects.create(
            user=user,
            card_binding=card,
            provider_request_id="S123",
            plan=Plan.STANDARD,
            billing_interval=BillingInterval.MONTH,
            amount=65,
            status=PaymentStatus.PENDING,
        )
        SubscriptionPayment.objects.filter(pk=payment.pk).update(
            created_at=timezone.now() - timedelta(minutes=31)
        )
        assert expire_all_stale_pending_payments() == 1
        payment.refresh_from_db()
        assert payment.status == PaymentStatus.EXPIRED

        mark_payment_paid(
            payment,
            {
                "RtnCode": 1,
                "OrderInfo": {
                    "MerchantTradeNo": payment.provider_request_id,
                    "TradeNo": "ecpay-trade-no",
                },
            },
        )

        payment.refresh_from_db()
        assert payment.status == PaymentStatus.PAID
        assert payment.provider_transaction_id == "ecpay-trade-no"
