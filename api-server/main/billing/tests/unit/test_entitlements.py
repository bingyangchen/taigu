from datetime import timedelta

import pytest
from django.utils import timezone

from main.account import OAuthOrganization
from main.account.models import User
from main.billing.entitlements import (
    QuotaExceededError,
    _get_entitlements,
    assert_can_add_favorite,
    assert_can_create_cash_dividend_record,
    assert_can_create_trade_record,
    serialize_entitlements,
)
from main.billing.models import BillingProfile, Plan, SubscriptionStatus
from main.cash_dividend.models import CashDividendRecord
from main.favorite.models import Favorite
from main.market.models import Company
from main.trade_record.models import TradeRecord


@pytest.mark.django_db
class TestEntitlements:
    @pytest.fixture
    def user(self) -> User:
        return User.objects.create_user(
            oauth_org=OAuthOrganization.GOOGLE,
            oauth_id="oauth-id",
            email="test@example.com",
            username="Test User",
        )

    @pytest.fixture
    def company(self) -> Company:
        return Company.objects.create(
            stock_id="2330", name="台積電", trade_type="tse", business="Semiconductor"
        )

    def test_new_user_gets_standard_trial(self, user: User) -> None:
        entitlements = _get_entitlements(user)

        assert entitlements.plan == Plan.STANDARD
        assert entitlements.status == SubscriptionStatus.TRIALING
        assert entitlements.billing_interval == "month"
        assert entitlements.market_refresh_interval_seconds == 30
        assert entitlements.quota.monthly_records is None
        assert entitlements.usage.monthly_records == 0

        serialized = serialize_entitlements(user)
        assert serialized["quota"]["monthly_records"] is None
        assert serialized["usage"]["monthly_records"] == 0

    def test_expired_trial_falls_back_to_free(self, user: User) -> None:
        BillingProfile.objects.create(
            user=user,
            plan=Plan.STANDARD,
            subscription_status=SubscriptionStatus.TRIALING,
            trial_started_at=timezone.now() - timedelta(days=40),
            trial_ends_at=timezone.now() - timedelta(days=9),
        )

        entitlements = _get_entitlements(user)

        assert entitlements.plan == Plan.FREE
        assert entitlements.market_refresh_interval_seconds == 600

    def test_free_record_monthly_quota_counts_trade_and_dividend(
        self, user: User, company: Company
    ) -> None:
        BillingProfile.objects.create(
            user=user, plan=Plan.FREE, subscription_status=SubscriptionStatus.CANCELED
        )
        for index in range(10):
            TradeRecord.objects.create(
                owner=user,
                company=company,
                deal_time=timezone.localdate(),
                deal_price=100 + index,
                deal_quantity=1000,
                handling_fee=1,
            )
            CashDividendRecord.objects.create(
                owner=user,
                company=company,
                deal_time=timezone.localdate(),
                cash_dividend=1,
            )

        with pytest.raises(QuotaExceededError):
            assert_can_create_trade_record(user)
        with pytest.raises(QuotaExceededError):
            assert_can_create_cash_dividend_record(user)

    def test_free_favorite_quota_allows_existing_favorite(
        self, user: User, company: Company
    ) -> None:
        BillingProfile.objects.create(
            user=user, plan=Plan.FREE, subscription_status=SubscriptionStatus.CANCELED
        )
        Favorite.objects.create(owner=user, company=company)

        assert_can_add_favorite(user, company.pk)
