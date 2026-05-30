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
    Plan,
    SubscriptionStatus,
)
from main.billing.services.subscription import _next_period_end, renew_due_subscriptions


class FakeEcpayClient:
    def create_payment_with_card_id(self, **kwargs) -> dict:  # noqa: ANN003
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
        self.started = threading.Event()
        self.release = threading.Event()
        self.calls = 0

    def create_payment_with_card_id(self, **kwargs) -> dict:  # noqa: ANN003
        self.calls += 1
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
    def test_concurrent_renewal_skips_locked_profile(self, user: User) -> None:
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
