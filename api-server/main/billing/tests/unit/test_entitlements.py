import json
from datetime import timedelta

import pytest
from django.test import RequestFactory
from django.utils import timezone

from main.account import OAuthOrganization
from main.account.models import User
from main.billing.models import (
    BillingProfile,
    Plan,
    StandardWhitelist,
    SubscriptionStatus,
)
from main.billing.services.entitlements import (
    QuotaExceededError,
    _get_entitlements,
    assert_can_add_favorite,
    assert_can_create_cash_dividend_record,
    assert_can_create_trade_record,
    serialize_entitlements,
)
from main.cash_dividend.models import CashDividendRecord
from main.favorite.models import Favorite
from main.favorite.views import create_or_delete_favorite
from main.market.models import Company
from main.trade_plan.models import TradePlan
from main.trade_plan.views import create_trade_plan
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

    @pytest.mark.scenario("BILL-R2.1", "MKT-R11.1")
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

    @pytest.mark.scenario("BILL-R2.2", "MKT-R11.2")
    def test_expired_trial_falls_back_to_free(self, user: User) -> None:
        BillingProfile.objects.create(
            user=user,
            plan=Plan.STANDARD,
            subscription_status=SubscriptionStatus.TRIALING,
            trial_started_at=timezone.now() - timedelta(days=40),
            trial_ends_at=timezone.now() - timedelta(minutes=1),
        )

        entitlements = _get_entitlements(user)

        assert entitlements.plan == Plan.FREE
        assert entitlements.market_refresh_interval_seconds == 600

    @pytest.mark.scenario("BILL-R1.6")
    def test_waiting_period_keeps_standard(self, user: User) -> None:
        period_ends_at = timezone.now() - timedelta(hours=1)
        BillingProfile.objects.create(
            user=user,
            plan=Plan.STANDARD,
            subscription_status=SubscriptionStatus.ACTIVE,
            current_period_started_at=period_ends_at - timedelta(days=31),
            current_period_ends_at=period_ends_at,
        )

        serialized = serialize_entitlements(user)

        assert serialized["plan"] == Plan.STANDARD
        assert serialized["is_awaiting_renewal"] is True
        assert serialized["quota"]["monthly_records"] is None

    @pytest.mark.scenario("BILL-R3.1")
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

    @pytest.mark.scenario("FAV-R3.1")
    def test_free_favorite_quota_allows_existing_favorite(
        self, user: User, company: Company
    ) -> None:
        BillingProfile.objects.create(
            user=user, plan=Plan.FREE, subscription_status=SubscriptionStatus.CANCELED
        )
        Favorite.objects.create(owner=user, company=company)
        for index in range(9):
            other_company = Company.objects.create(
                stock_id=f"9{index:03d}", name=f"Other {index}"
            )
            Favorite.objects.create(owner=user, company=other_company)

        assert_can_add_favorite(user, company.pk)


@pytest.mark.django_db
class TestStandardWhitelistEntitlements:
    @pytest.fixture
    def user(self) -> User:
        user = User.objects.create_user(
            oauth_org=OAuthOrganization.GOOGLE,
            oauth_id="oauth-id",
            email="test@example.com",
            username="Test User",
        )
        StandardWhitelist.objects.create(user=user)
        return user

    @pytest.fixture
    def company(self) -> Company:
        return Company.objects.create(
            stock_id="2330", name="台積電", trade_type="tse", business="Semiconductor"
        )

    @pytest.mark.scenario("BILL-R1.3")
    def test_whitelisted_user_adds_favorite_after_trial_ends(
        self, user: User, company: Company
    ) -> None:
        BillingProfile.objects.create(
            user=user,
            plan=Plan.FREE,
            subscription_status=SubscriptionStatus.CANCELED,
            trial_started_at=timezone.now() - timedelta(days=40),
            trial_ends_at=timezone.now() - timedelta(days=9),
        )
        for index in range(10):
            other_company = Company.objects.create(
                stock_id=f"9{index:03d}", name=f"Other {index}"
            )
            Favorite.objects.create(owner=user, company=other_company)
        request = RequestFactory().post("/")
        request.user = user

        response = create_or_delete_favorite(request, company.pk)

        assert response.status_code == 200
        assert Favorite.objects.filter(owner=user, company=company).exists()

    @pytest.mark.scenario("BILL-R1.5")
    def test_whitelisted_user_creates_trade_plan_after_stopped_period_ends(
        self, user: User, company: Company
    ) -> None:
        period_ends_at = timezone.now() - timedelta(minutes=1)
        BillingProfile.objects.create(
            user=user,
            plan=Plan.STANDARD,
            subscription_status=SubscriptionStatus.ACTIVE,
            current_period_started_at=period_ends_at - timedelta(days=31),
            current_period_ends_at=period_ends_at,
            cancel_at_period_end=True,
        )
        for _ in range(10):
            TradePlan.objects.create(
                owner=user,
                company=company,
                plan_type="buy",
                target_price=100,
                target_quantity=1000,
            )
        request = RequestFactory().post(
            "/",
            data=json.dumps(
                {
                    "sid": company.pk,
                    "plan_type": "buy",
                    "target_price": 100,
                    "target_quantity": 1000,
                }
            ),
            content_type="application/json",
        )
        request.user = user

        response = create_trade_plan(request)

        assert response.status_code == 200
        assert TradePlan.objects.filter(owner=user).count() == 11

    @pytest.mark.parametrize(
        ("period_ends_in", "expected"),
        [(timedelta(days=28), True), (-timedelta(minutes=1), False)],
    )
    def test_current_period_active_follows_period_end_for_whitelisted_user(
        self, user: User, period_ends_in: timedelta, expected: bool
    ) -> None:
        """
        A whitelisted user's plan is Standard whether or not the period has ended,
        so the plan page relies on this field to decide whether to show the paid
        layout and the stop-auto-renewal button.
        """
        period_ends_at = timezone.now() + period_ends_in
        BillingProfile.objects.create(
            user=user,
            plan=Plan.STANDARD,
            subscription_status=SubscriptionStatus.ACTIVE,
            current_period_started_at=period_ends_at - timedelta(days=31),
            current_period_ends_at=period_ends_at,
        )

        serialized = serialize_entitlements(user)

        assert serialized["plan"] == Plan.STANDARD
        assert serialized["is_current_period_active"] is expected
