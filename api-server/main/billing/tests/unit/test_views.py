import json
from datetime import timedelta

import pytest
from _pytest.monkeypatch import MonkeyPatch
from django.test import RequestFactory
from django.utils import timezone

from main.account import OAuthOrganization
from main.account.models import User
from main.billing.models import (
    BillingInterval,
    BillingProfile,
    PaymentStatus,
    Plan,
    StandardWhitelist,
    SubscriptionPayment,
    SubscriptionStatus,
)
from main.billing.views import cancel_subscription


@pytest.mark.django_db
class TestCancelSubscriptionView:
    @pytest.fixture
    def user(self) -> User:
        return User.objects.create_user(
            oauth_org=OAuthOrganization.GOOGLE,
            oauth_id="oauth-id",
            email="test@example.com",
            username="Test User",
        )

    @pytest.mark.scenario("BILL-R23.4")
    def test_trialing_user_cannot_cancel_subscription(self, user: User) -> None:
        trial_started_at = timezone.now() - timedelta(days=1)
        trial_ends_at = timezone.now() + timedelta(days=30)
        BillingProfile.objects.create(
            user=user,
            plan=Plan.STANDARD,
            subscription_status=SubscriptionStatus.TRIALING,
            trial_started_at=trial_started_at,
            trial_ends_at=trial_ends_at,
        )
        request = RequestFactory().post("/api/billing/subscription/cancel")
        request.user = user

        response = cancel_subscription.__wrapped__(request)

        profile = BillingProfile.objects.get(user=user)
        data = json.loads(response.content)
        assert response.status_code == 400
        assert data["message"] == "No active subscription to cancel"
        assert profile.plan == Plan.STANDARD
        assert profile.subscription_status == SubscriptionStatus.TRIALING
        assert profile.trial_started_at == trial_started_at
        assert profile.trial_ends_at == trial_ends_at

    @pytest.mark.scenario("BILL-R23.5")
    def test_free_user_cannot_cancel_subscription(self, user: User) -> None:
        BillingProfile.objects.create(
            user=user, plan=Plan.FREE, subscription_status=SubscriptionStatus.CANCELED
        )
        request = RequestFactory().post("/api/billing/subscription/cancel")
        request.user = user

        response = cancel_subscription.__wrapped__(request)

        profile = BillingProfile.objects.get(user=user)
        data = json.loads(response.content)
        assert response.status_code == 400
        assert data["message"] == "No active subscription to cancel"
        assert profile.plan == Plan.FREE
        assert profile.subscription_status == SubscriptionStatus.CANCELED
        assert profile.cancel_at_period_end is False

    @pytest.mark.scenario("BILL-R23.8")
    def test_whitelisted_user_stops_auto_renewal(
        self, user: User, monkeypatch: MonkeyPatch
    ) -> None:
        canceled_trade_nos: list[str] = []

        class FakeEcpayClient:
            def cancel_aio_periodic_order(self, *, merchant_trade_no: str) -> dict:
                canceled_trade_nos.append(merchant_trade_no)
                return {}

        monkeypatch.setattr("main.billing.views.EcpayClient", FakeEcpayClient)
        period_ends_at = timezone.now() + timedelta(days=28)
        BillingProfile.objects.create(
            user=user,
            plan=Plan.STANDARD,
            subscription_status=SubscriptionStatus.ACTIVE,
            billing_interval=BillingInterval.MONTH,
            current_period_started_at=period_ends_at - timedelta(days=31),
            current_period_ends_at=period_ends_at,
        )
        StandardWhitelist.objects.create(user=user)
        SubscriptionPayment.objects.create(
            user=user,
            provider_request_id="S123",
            provider_subscription_id="S123",
            provider_transaction_id="ecpay-trade-no",
            plan=Plan.STANDARD,
            billing_interval=BillingInterval.MONTH,
            amount=65,
            status=PaymentStatus.PAID,
            paid_at=period_ends_at - timedelta(days=31),
        )
        request = RequestFactory().post("/api/billing/subscription/cancel")
        request.user = user

        response = cancel_subscription.__wrapped__(request)

        profile = BillingProfile.objects.get(user=user)
        subscription = json.loads(response.content)["subscription"]
        assert response.status_code == 200
        assert canceled_trade_nos == ["S123"]
        assert profile.subscription_status == SubscriptionStatus.ACTIVE
        assert profile.cancel_at_period_end is True
        assert profile.current_period_ends_at == period_ends_at
        assert subscription["is_whitelisted"] is True
        assert subscription["cancel_at_period_end"] is True
