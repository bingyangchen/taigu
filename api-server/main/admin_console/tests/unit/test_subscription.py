import uuid
from datetime import UTC, date, datetime, timedelta
from zoneinfo import ZoneInfo

import pytest
from django.http import HttpRequest
from django.utils import timezone

from main.account import OAuthOrganization
from main.account.models import User
from main.account.views import me
from main.admin_console.services.subscription import (
    count_whitelisted_users,
    get_monthly_payments,
    get_subscription_status_counts,
    get_trial_conversions,
)
from main.billing.models import (
    BillingInterval,
    BillingProfile,
    PaymentStatus,
    Plan,
    StandardWhitelist,
    SubscriptionPayment,
    SubscriptionStatus,
)
from main.billing.services.entitlements import TRIAL_LENGTH

TAIPEI = ZoneInfo("Asia/Taipei")
NOW = datetime(2026, 12, 10, 12, tzinfo=TAIPEI)


def _taipei(*args: int) -> datetime:
    return datetime(*args, tzinfo=TAIPEI)  # type: ignore


def _create_user(name: str) -> User:
    return User.objects.create_user(
        oauth_org=OAuthOrganization.GOOGLE,
        oauth_id=name,
        email=f"{name}@example.com",
        username=name,
    )


def _create_trial_user(
    name: str, started_at: datetime, ends_at: datetime | None = None
) -> User:
    user = _create_user(name)
    BillingProfile.objects.create(
        user=user,
        plan=Plan.FREE,
        subscription_status=SubscriptionStatus.CANCELED,
        trial_started_at=started_at,
        trial_ends_at=ends_at or started_at + TRIAL_LENGTH,
    )
    return user


def _pay(
    user: User,
    paid_at: datetime | None,
    *,
    amount: int = 65,
    interval: str = BillingInterval.MONTH,
    status: str = PaymentStatus.PAID,
    provider_request_id: str | None = None,
) -> None:
    SubscriptionPayment.objects.create(
        user=user,
        provider_request_id=provider_request_id or uuid.uuid4().hex,
        provider_transaction_id=uuid.uuid4().hex
        if status == PaymentStatus.PAID
        else None,
        billing_interval=interval,
        amount=amount,
        status=status,
        paid_at=paid_at,
    )


def _get_row(rows: list[dict], month: str) -> dict:
    return next(row for row in rows if row["month"] == month)


@pytest.mark.django_db
class TestTrialConversions:
    @pytest.mark.scenario("ADMIN-R9.1")
    def test_payment_during_trial(self) -> None:
        user = _create_trial_user(
            "a", _taipei(2026, 10, 21), ends_at=_taipei(2026, 11, 21)
        )
        _pay(user, _taipei(2026, 11, 1))

        row = _get_row(get_trial_conversions(NOW), "2026-10")

        assert row["trials"] == 1
        assert row["paid"] == 1

    @pytest.mark.scenario("ADMIN-R9.2")
    def test_payment_exactly_30_days_after_trial(self) -> None:
        user = _create_trial_user(
            "a", _taipei(2026, 10, 21, 10), ends_at=_taipei(2026, 11, 21, 10)
        )
        _pay(user, _taipei(2026, 12, 21, 10))

        row = _get_row(get_trial_conversions(_taipei(2027, 1, 10)), "2026-10")

        assert row["paid"] == 1

    @pytest.mark.scenario("ADMIN-R9.3")
    def test_payment_more_than_30_days_after_trial(self) -> None:
        user = _create_trial_user(
            "a", _taipei(2026, 10, 21, 10), ends_at=_taipei(2026, 11, 21, 10)
        )
        _pay(user, _taipei(2026, 12, 21, 10, 1))

        row = _get_row(get_trial_conversions(_taipei(2027, 1, 10)), "2026-10")

        assert row["trials"] == 1
        assert row["paid"] == 0

    @pytest.mark.scenario("ADMIN-R9.4")
    def test_whitelisted_user_is_left_out(self) -> None:
        user = _create_trial_user("a", _taipei(2026, 10, 21))
        _pay(user, _taipei(2026, 11, 1))
        StandardWhitelist.objects.create(user=user)
        _create_trial_user("b", _taipei(2026, 10, 22))

        row = _get_row(get_trial_conversions(NOW), "2026-10")

        assert row["trials"] == 1
        assert row["paid"] == 0

    @pytest.mark.scenario("ADMIN-R9.5")
    def test_trial_long_after_signup(self) -> None:
        user = _create_trial_user("a", _taipei(2026, 6, 15))
        user.date_joined = _taipei(2021, 3, 1)
        user.save()
        _create_trial_user("b", _taipei(2026, 8, 1))

        rows = get_trial_conversions(NOW)

        assert rows[-1]["month"] == "2026-06"
        assert rows[-1]["trials"] == 1

    @pytest.mark.scenario("ADMIN-R9.6")
    def test_user_without_trial_is_left_out(self) -> None:
        user = _create_user("a")
        user.date_joined = _taipei(2021, 3, 1)
        user.save()
        _create_trial_user("b", _taipei(2026, 6, 15))

        rows = get_trial_conversions(NOW)

        assert [row["month"] for row in rows] == [
            "2026-12",
            "2026-11",
            "2026-10",
            "2026-09",
            "2026-08",
            "2026-07",
            "2026-06",
        ]
        assert rows[-1]["trials"] == 1

    @pytest.mark.scenario("ADMIN-R9.7")
    def test_in_progress_and_settled(self) -> None:
        _create_trial_user("a", _taipei(2026, 9, 10))
        _create_trial_user("b", _taipei(2026, 10, 10))
        _create_trial_user("c", _taipei(2026, 12, 1))

        rows = get_trial_conversions(NOW)

        assert _get_row(rows, "2026-12")["status"] == "in_progress"
        assert _get_row(rows, "2026-12")["settles_on"] == "2027-03-02"
        assert _get_row(rows, "2026-10")["status"] == "in_progress"
        assert _get_row(rows, "2026-10")["settles_on"] == "2026-12-31"
        assert _get_row(rows, "2026-09")["status"] == "settled"
        assert _get_row(rows, "2026-09")["settles_on"] is None

    @pytest.mark.scenario("ADMIN-R9.8")
    def test_conversion_rate(self) -> None:
        for i in range(76):
            user = _create_trial_user(f"u{i}", _taipei(2026, 10, 10))
            if i < 9:
                _pay(user, _taipei(2026, 10, 20))

        row = _get_row(get_trial_conversions(NOW), "2026-10")

        assert row["conversion_rate"] == "11.8"

    @pytest.mark.scenario("ADMIN-R9.9")
    def test_conversion_rate_rounds_half_up(self) -> None:
        for i in range(16):
            user = _create_trial_user(f"u{i}", _taipei(2026, 10, 10))
            if i < 1:
                _pay(user, _taipei(2026, 10, 20))

        row = _get_row(get_trial_conversions(NOW), "2026-10")

        assert row["conversion_rate"] == "6.3"

    @pytest.mark.scenario("ADMIN-R9.10")
    def test_one_minute_before_and_at_settlement(self) -> None:
        _create_trial_user("a", _taipei(2026, 10, 10))

        before = _get_row(
            get_trial_conversions(_taipei(2026, 12, 31, 23, 59)), "2026-10"
        )
        at = _get_row(get_trial_conversions(_taipei(2027, 1, 1)), "2026-10")

        assert before["status"] == "in_progress"
        assert before["settles_on"] == "2026-12-31"
        assert at["status"] == "settled"

    @pytest.mark.scenario("ADMIN-R9.11")
    def test_trial_month_uses_taiwan_time(self) -> None:
        _create_trial_user("early", _taipei(2026, 8, 10))
        _create_trial_user("a", datetime(2026, 9, 30, 17, tzinfo=UTC))

        rows = get_trial_conversions(NOW)

        assert _get_row(rows, "2026-10")["trials"] == 1
        assert _get_row(rows, "2026-09")["trials"] == 0

    @pytest.mark.scenario("ADMIN-R9.12")
    def test_month_without_trials(self) -> None:
        _create_trial_user("a", _taipei(2026, 7, 10))
        _create_trial_user("b", _taipei(2026, 9, 10))

        row = _get_row(get_trial_conversions(NOW), "2026-08")

        assert row == {
            "month": "2026-08",
            "trials": 0,
            "paid": 0,
            "conversion_rate": None,
            "status": None,
            "settles_on": None,
        }

    def test_no_trials(self) -> None:
        _create_user("a")

        assert get_trial_conversions(NOW) == []


@pytest.mark.django_db
class TestSubscriptionStatusCounts:
    def _create_profile(self, name: str, **fields: object) -> User:
        user = _create_user(name)
        BillingProfile.objects.create(user=user, **fields)
        return user

    def _create_trialing(self, name: str, trial_ends_at: datetime) -> User:
        return self._create_profile(
            name,
            plan=Plan.STANDARD,
            subscription_status=SubscriptionStatus.TRIALING,
            trial_started_at=trial_ends_at - TRIAL_LENGTH,
            trial_ends_at=trial_ends_at,
        )

    def _create_active(
        self, name: str, period_ends_at: datetime, *, cancel_at_period_end: bool
    ) -> User:
        return self._create_profile(
            name,
            plan=Plan.STANDARD,
            subscription_status=SubscriptionStatus.ACTIVE,
            current_period_started_at=period_ends_at - timedelta(days=31),
            current_period_ends_at=period_ends_at,
            cancel_at_period_end=cancel_at_period_end,
        )

    def _create_unsubscribed(self, name: str) -> User:
        return self._create_profile(
            name, plan=Plan.FREE, subscription_status=SubscriptionStatus.CANCELED
        )

    @pytest.mark.scenario("ADMIN-R10.1")
    def test_counts_by_status(self) -> None:
        later = timezone.now() + timedelta(days=10)
        for i in range(3):
            self._create_trialing(f"trial{i}", later)
        for i in range(2):
            self._create_active(f"active{i}", later, cancel_at_period_end=False)
        self._create_active("stopped", later, cancel_at_period_end=True)
        self._create_profile(
            "past_due",
            plan=Plan.STANDARD,
            subscription_status=SubscriptionStatus.PAST_DUE,
            current_period_started_at=timezone.now() - timedelta(days=33),
            current_period_ends_at=timezone.now() - timedelta(days=2),
        )
        unsubscribed = [self._create_unsubscribed(f"free{i}") for i in range(4)]
        StandardWhitelist.objects.create(user=unsubscribed[0])

        assert get_subscription_status_counts() == {
            "trialing": 3,
            "auto_renewing": 2,
            "auto_renewal_stopped": 1,
            "past_due": 1,
            "unsubscribed": 4,
        }
        assert count_whitelisted_users() == 1

    @pytest.mark.scenario("ADMIN-R10.2")
    def test_trial_just_ended_before_daily_reconciliation(self) -> None:
        self._create_trialing("a", timezone.now() - timedelta(minutes=1))

        assert get_subscription_status_counts()["trialing"] == 1

    @pytest.mark.scenario("ADMIN-R10.3")
    def test_trial_just_ended_then_user_opens_taigu(self) -> None:
        user = self._create_trialing("a", timezone.now() - timedelta(minutes=1))
        request = HttpRequest()
        request.method = "GET"
        request.user = user
        me(request)

        counts = get_subscription_status_counts()

        assert counts["trialing"] == 0
        assert counts["unsubscribed"] == 1

    @pytest.mark.scenario("ADMIN-R10.4")
    def test_user_without_billing_profile(self) -> None:
        _create_user("a")

        assert get_subscription_status_counts()["unsubscribed"] == 1

    @pytest.mark.scenario("ADMIN-R10.5")
    def test_stopped_auto_renewal_just_ended(self) -> None:
        user = self._create_active(
            "a", timezone.now() - timedelta(minutes=1), cancel_at_period_end=True
        )
        request = HttpRequest()
        request.method = "GET"
        request.user = user
        me(request)

        assert get_subscription_status_counts()["auto_renewal_stopped"] == 1

    @pytest.mark.scenario("ADMIN-R10.6")
    def test_auto_renewing_period_just_ended(self) -> None:
        self._create_active(
            "a", timezone.now() - timedelta(hours=1), cancel_at_period_end=False
        )

        counts = get_subscription_status_counts()

        assert counts["auto_renewing"] == 1
        assert counts["past_due"] == 0


@pytest.mark.django_db
class TestMonthlyPayments:
    TODAY = date(2026, 12, 10)

    @pytest.mark.scenario("ADMIN-R11.1")
    def test_amount_and_count_of_a_month(self) -> None:
        user_a, user_b, user_c, user_d = (_create_user(f"u{i}") for i in range(4))
        _pay(user_a, _taipei(2026, 11, 3))
        _pay(user_b, _taipei(2026, 11, 5))
        _pay(user_c, _taipei(2026, 11, 8), provider_request_id="S20261008P2")
        _pay(user_d, _taipei(2026, 11, 9), amount=700, interval=BillingInterval.YEAR)
        _pay(user_a, None, status=PaymentStatus.FAILED)

        row = _get_row(get_monthly_payments(self.TODAY), "2026-11")

        assert row == {"month": "2026-11", "count": 4, "amount": 895}

    @pytest.mark.scenario("ADMIN-R11.2")
    def test_month_without_payments(self) -> None:
        user = _create_user("a")
        _pay(user, _taipei(2026, 9, 3))
        _pay(user, _taipei(2026, 11, 3))

        rows = get_monthly_payments(self.TODAY)

        assert [row["month"] for row in rows] == [
            "2026-09",
            "2026-10",
            "2026-11",
            "2026-12",
        ]
        assert _get_row(rows, "2026-10") == {
            "month": "2026-10",
            "count": 0,
            "amount": 0,
        }

    @pytest.mark.scenario("ADMIN-R11.3")
    def test_month_uses_taiwan_time(self) -> None:
        user = _create_user("a")
        _pay(user, _taipei(2026, 9, 3))
        _pay(user, datetime(2026, 10, 31, 17, tzinfo=UTC))

        rows = get_monthly_payments(self.TODAY)

        assert _get_row(rows, "2026-10") == {
            "month": "2026-10",
            "count": 0,
            "amount": 0,
        }
        assert _get_row(rows, "2026-11") == {
            "month": "2026-11",
            "count": 1,
            "amount": 65,
        }

    @pytest.mark.scenario("ADMIN-R11.4")
    def test_subscribing_again(self) -> None:
        user = _create_user("a")
        _pay(user, _taipei(2026, 9, 3))
        _pay(user, _taipei(2026, 11, 5))

        row = _get_row(get_monthly_payments(self.TODAY), "2026-11")

        assert row == {"month": "2026-11", "count": 1, "amount": 65}

    def test_no_payments(self) -> None:
        assert get_monthly_payments(self.TODAY) == []
