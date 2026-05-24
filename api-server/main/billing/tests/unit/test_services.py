from datetime import timedelta

import pytest
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
from main.billing.services import renew_due_subscriptions


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
