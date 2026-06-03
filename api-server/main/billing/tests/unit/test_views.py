import json
from datetime import timedelta

import pytest
from django.test import RequestFactory
from django.utils import timezone

from main.account import OAuthOrganization
from main.account.models import User
from main.billing.models import BillingProfile, Plan, SubscriptionStatus
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
