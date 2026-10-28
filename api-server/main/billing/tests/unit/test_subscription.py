from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

import pytest
import requests
from _pytest.monkeypatch import MonkeyPatch
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
from main.billing.services.entitlements import serialize_entitlements
from main.billing.services.subscription import (
    STALE_PAYMENT_FAILURE_MESSAGE,
    STANDARD_PRICES,
    SUPERSEDED_PAYMENT_FAILURE_MESSAGE,
    SubscriptionPaymentNotChargeableError,
    SubscriptionPaymentValidationError,
    create_subscription_checkout,
    expire_stale_pending_payments,
    mark_payment_failed,
    mark_payment_paid,
    process_period_payment_callback,
    reconcile_due_billing_profiles,
    stop_auto_renewal,
    terminate_pending_provider_subscriptions,
)
from main.billing.tests.unit.fake_ecpay import (
    ORDER_DISABLED_RTN_CODE,
    TERMINATION_FAILED_RTN_CODE,
    FakeEcpay,
)

TAIPEI = ZoneInfo("Asia/Taipei")


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


@pytest.fixture
def user() -> User:
    return User.objects.create_user(
        oauth_org=OAuthOrganization.GOOGLE,
        oauth_id="oauth-id",
        email="test@example.com",
        username="Test User",
    )


def _taipei_time(*args: int) -> datetime:
    return datetime(*args, tzinfo=TAIPEI)


def _freeze_time(monkeypatch: MonkeyPatch, now: datetime) -> None:
    monkeypatch.setattr("django.utils.timezone.now", lambda: now)


def _make_return_data(payment: SubscriptionPayment) -> dict:
    return {
        "RtnCode": 1,
        "OrderInfo": {
            "MerchantTradeNo": payment.provider_request_id,
            "TradeNo": f"T{payment.provider_request_id}",
            "TotalAmount": payment.amount,
        },
    }


def _make_period_callback(
    order: SubscriptionPayment,
    *,
    total_success_times: int,
    gwsr: str,
    rtn_code: int = 1,
) -> dict:
    return {
        "MerchantTradeNo": order.provider_subscription_id,
        "RtnCode": rtn_code,
        "RtnMsg": "fake",
        "Gwsr": gwsr,
        "Amount": order.amount,
        "TotalSuccessTimes": total_success_times,
    }


def _pay(
    user: User,
    monkeypatch: MonkeyPatch,
    *,
    paid_at: datetime,
    interval: BillingInterval = BillingInterval.MONTH,
    trade_no: str = "S1",
) -> SubscriptionPayment:
    _freeze_time(monkeypatch, paid_at)
    payment = SubscriptionPayment.objects.create(
        user=user,
        provider_request_id=trade_no,
        billing_interval=interval,
        amount=STANDARD_PRICES[interval],
    )
    mark_payment_paid(payment, _make_return_data(payment))
    payment.refresh_from_db()
    return payment


def _subscribe(
    user: User,
    ecpay: FakeEcpay,
    monkeypatch: MonkeyPatch,
    *,
    paid_at: datetime,
    interval: BillingInterval = BillingInterval.MONTH,
    trade_no: str = "S1",
) -> SubscriptionPayment:
    payment = _pay(
        user, monkeypatch, paid_at=paid_at, interval=interval, trade_no=trade_no
    )
    ecpay.add_charge(
        trade_no,
        gwsr="1001",
        process_date=paid_at.strftime("%Y/%m/%d %H:%M:%S"),
        amount=payment.amount,
    )
    return payment


def _get_profile(user: User) -> BillingProfile:
    return BillingProfile.objects.get(user=user)


@pytest.mark.django_db
class TestPeriodEnd:
    @pytest.mark.scenario("BILL-R14.2")
    def test_month_end_payment_ends_on_last_day_of_next_month(
        self, user: User, monkeypatch: MonkeyPatch
    ) -> None:
        _pay(user, monkeypatch, paid_at=_taipei_time(2024, 1, 31, 10, 0))

        assert _get_profile(user).current_period_ends_at == _taipei_time(
            2024, 2, 29, 10, 0
        )

    @pytest.mark.scenario("BILL-R14.4")
    def test_period_is_counted_in_taiwan_time(
        self, user: User, monkeypatch: MonkeyPatch
    ) -> None:
        """
        Counted in UTC, a payment at 05:00 on the 31st falls on the 30th, so the period
        would end on 12/1 instead of on ECPay's charge day, 11/30.
        """
        _pay(user, monkeypatch, paid_at=_taipei_time(2026, 10, 31, 5, 0))

        assert _get_profile(user).current_period_ends_at == _taipei_time(
            2026, 11, 30, 5, 0
        )

    @pytest.mark.scenario("BILL-R14.5")
    def test_yearly_payment_on_leap_day(
        self, user: User, monkeypatch: MonkeyPatch
    ) -> None:
        _pay(
            user,
            monkeypatch,
            paid_at=_taipei_time(2028, 2, 29, 10, 0),
            interval=BillingInterval.YEAR,
        )

        assert _get_profile(user).current_period_ends_at == _taipei_time(
            2029, 2, 28, 10, 0
        )

    @pytest.mark.scenario("BILL-R14.6")
    def test_repeated_success_callback_keeps_period(
        self, user: User, ecpay: FakeEcpay, monkeypatch: MonkeyPatch
    ) -> None:
        payment = _pay(user, monkeypatch, paid_at=_taipei_time(2026, 10, 21, 10, 0))
        _freeze_time(monkeypatch, _taipei_time(2026, 10, 21, 10, 10))

        mark_payment_paid(payment, _make_return_data(payment))

        profile = _get_profile(user)
        assert profile.subscription_status == SubscriptionStatus.ACTIVE
        assert profile.current_period_ends_at == _taipei_time(2026, 11, 21, 10, 0)
        assert ecpay.terminated_trade_nos == []

    @pytest.mark.scenario("BILL-R15.2")
    def test_failure_callback_after_success_keeps_payment_paid(
        self, user: User, monkeypatch: MonkeyPatch
    ) -> None:
        payment = _pay(user, monkeypatch, paid_at=_taipei_time(2026, 10, 21, 10, 0))

        mark_payment_failed(payment.provider_request_id, {"RtnCode": 0, "RtnMsg": "x"})

        payment.refresh_from_db()
        assert payment.status == PaymentStatus.PAID
        assert _get_profile(user).subscription_status == SubscriptionStatus.ACTIVE


@pytest.mark.django_db
class TestPeriodCharge:
    @pytest.mark.scenario("BILL-R20.1")
    def test_charge_before_period_end_extends_period(
        self, user: User, ecpay: FakeEcpay, monkeypatch: MonkeyPatch
    ) -> None:
        order = _subscribe(
            user, ecpay, monkeypatch, paid_at=_taipei_time(2026, 9, 21, 10, 0)
        )
        _freeze_time(monkeypatch, _taipei_time(2026, 10, 21, 1, 0))

        process_period_payment_callback(
            _make_period_callback(order, total_success_times=2, gwsr="1002")
        )

        profile = _get_profile(user)
        assert profile.subscription_status == SubscriptionStatus.ACTIVE
        assert profile.current_period_ends_at == _taipei_time(2026, 11, 21, 10, 0)

    @pytest.mark.scenario("BILL-R20.3")
    def test_second_period_after_month_end_payment(
        self, user: User, ecpay: FakeEcpay, monkeypatch: MonkeyPatch
    ) -> None:
        """
        Counted from the end of February, the third period would end on 3/29, two
        days before ECPay's charge day, 3/31.
        """
        order = _subscribe(
            user, ecpay, monkeypatch, paid_at=_taipei_time(2024, 1, 31, 10, 0)
        )
        _freeze_time(monkeypatch, _taipei_time(2024, 2, 29, 1, 0))

        process_period_payment_callback(
            _make_period_callback(order, total_success_times=2, gwsr="1002")
        )

        assert _get_profile(user).current_period_ends_at == _taipei_time(
            2024, 3, 31, 10, 0
        )

    @pytest.mark.scenario("BILL-R20.4")
    def test_charge_in_waiting_period_extends_period(
        self, user: User, ecpay: FakeEcpay, monkeypatch: MonkeyPatch
    ) -> None:
        order = _subscribe(
            user, ecpay, monkeypatch, paid_at=_taipei_time(2026, 9, 21, 10, 0)
        )
        _freeze_time(monkeypatch, _taipei_time(2026, 10, 21, 20, 0))

        process_period_payment_callback(
            _make_period_callback(order, total_success_times=2, gwsr="1002")
        )

        profile = _get_profile(user)
        assert profile.current_period_ends_at == _taipei_time(2026, 11, 21, 10, 0)
        assert serialize_entitlements(user)["is_awaiting_renewal"] is False

    @pytest.mark.scenario("BILL-R20.5")
    def test_callback_after_query_recorded_the_charge_keeps_period(
        self, user: User, ecpay: FakeEcpay, monkeypatch: MonkeyPatch
    ) -> None:
        """
        ECPay can still deliver a charge's callback after the daily reconciliation
        recorded the charge from its query; extending again would give the user a
        period they did not pay for.
        """
        order = _subscribe(
            user, ecpay, monkeypatch, paid_at=_taipei_time(2026, 9, 20, 10, 0)
        )
        ecpay.add_charge("S1", gwsr="1002", process_date="2026/10/20 01:00:00")
        _freeze_time(monkeypatch, _taipei_time(2026, 10, 21, 3, 40))
        reconcile_due_billing_profiles()
        assert _get_profile(user).current_period_ends_at == _taipei_time(
            2026, 11, 20, 10, 0
        )

        process_period_payment_callback(
            _make_period_callback(order, total_success_times=2, gwsr="1002")
        )

        assert _get_profile(user).current_period_ends_at == _taipei_time(
            2026, 11, 20, 10, 0
        )

    @pytest.mark.scenario("BILL-R21.1")
    def test_failed_charge_only_records_failure(
        self, user: User, ecpay: FakeEcpay, monkeypatch: MonkeyPatch
    ) -> None:
        order = _subscribe(
            user, ecpay, monkeypatch, paid_at=_taipei_time(2026, 9, 21, 10, 0)
        )
        _freeze_time(monkeypatch, _taipei_time(2026, 10, 21, 1, 0))

        process_period_payment_callback(
            _make_period_callback(order, total_success_times=1, gwsr="1002", rtn_code=0)
        )

        profile = _get_profile(user)
        order.refresh_from_db()
        assert profile.subscription_status == SubscriptionStatus.ACTIVE
        assert profile.current_period_ends_at == _taipei_time(2026, 10, 21, 10, 0)
        assert serialize_entitlements(user)["plan"] == Plan.STANDARD
        assert order.status == PaymentStatus.PAID
        assert SubscriptionPayment.objects.filter(
            user=user, status=PaymentStatus.FAILED
        ).exists()

    @pytest.mark.scenario("BILL-R26.2")
    def test_whitelisted_user_charge_extends_period(
        self, user: User, ecpay: FakeEcpay, monkeypatch: MonkeyPatch
    ) -> None:
        order = _subscribe(
            user, ecpay, monkeypatch, paid_at=_taipei_time(2026, 9, 21, 10, 0)
        )
        StandardWhitelist.objects.create(user=user)
        _freeze_time(monkeypatch, _taipei_time(2026, 10, 21, 11, 0))

        process_period_payment_callback(
            _make_period_callback(order, total_success_times=2, gwsr="1002")
        )

        profile = _get_profile(user)
        assert profile.subscription_status == SubscriptionStatus.ACTIVE
        assert profile.current_period_ends_at == _taipei_time(2026, 11, 21, 10, 0)


@pytest.mark.django_db
class TestRenewalSettlement:
    @pytest.mark.scenario("BILL-R22.1")
    def test_period_ending_today_waits(
        self, user: User, ecpay: FakeEcpay, monkeypatch: MonkeyPatch
    ) -> None:
        _subscribe(user, ecpay, monkeypatch, paid_at=_taipei_time(2026, 9, 21, 0, 30))
        _freeze_time(monkeypatch, _taipei_time(2026, 10, 21, 3, 40))

        reconcile_due_billing_profiles()

        profile = _get_profile(user)
        assert profile.subscription_status == SubscriptionStatus.ACTIVE
        assert profile.current_period_ends_at == _taipei_time(2026, 10, 21, 0, 30)
        assert serialize_entitlements(user)["is_awaiting_renewal"] is True
        assert ecpay.queried_trade_nos == []

    @pytest.mark.scenario("BILL-R22.2", "BILL-R10.11")
    def test_unpaid_period_ends_subscription(
        self, user: User, ecpay: FakeEcpay, monkeypatch: MonkeyPatch
    ) -> None:
        _subscribe(user, ecpay, monkeypatch, paid_at=_taipei_time(2026, 9, 20, 23, 59))
        _freeze_time(monkeypatch, _taipei_time(2026, 10, 21, 3, 40))

        reconcile_due_billing_profiles()

        profile = _get_profile(user)
        subscription = serialize_entitlements(user)
        assert ecpay.terminated_trade_nos == ["S1"]
        assert profile.subscription_status == SubscriptionStatus.CANCELED
        assert subscription["plan"] == Plan.FREE
        assert subscription["ended_by_failed_renewal"] is True

    @pytest.mark.scenario("BILL-R22.3")
    def test_unnotified_charge_extends_period(
        self, user: User, ecpay: FakeEcpay, monkeypatch: MonkeyPatch
    ) -> None:
        _subscribe(user, ecpay, monkeypatch, paid_at=_taipei_time(2026, 9, 20, 10, 0))
        ecpay.add_charge("S1", gwsr="1002", process_date="2026/10/20 01:00:00")
        _freeze_time(monkeypatch, _taipei_time(2026, 10, 21, 3, 40))

        reconcile_due_billing_profiles()

        profile = _get_profile(user)
        assert profile.subscription_status == SubscriptionStatus.ACTIVE
        assert profile.current_period_ends_at == _taipei_time(2026, 11, 20, 10, 0)
        assert ecpay.terminated_trade_nos == []
        assert (
            SubscriptionPayment.objects.get(
                provider_request_id="S1P2"
            ).provider_transaction_id
            == "1002"
        )

    @pytest.mark.scenario("BILL-R22.4")
    def test_query_timeout_keeps_waiting_until_next_run(
        self, user: User, ecpay: FakeEcpay, monkeypatch: MonkeyPatch
    ) -> None:
        _subscribe(user, ecpay, monkeypatch, paid_at=_taipei_time(2026, 9, 20, 10, 0))
        ecpay.trade_no_to_query_error["S1"] = requests.Timeout()
        _freeze_time(monkeypatch, _taipei_time(2026, 10, 21, 3, 40))

        reconcile_due_billing_profiles()

        subscription = serialize_entitlements(user)
        assert _get_profile(user).subscription_status == SubscriptionStatus.ACTIVE
        assert subscription["is_awaiting_renewal"] is True
        assert subscription["plan"] == Plan.STANDARD

        _freeze_time(monkeypatch, _taipei_time(2026, 10, 22, 3, 40))
        reconcile_due_billing_profiles()

        assert ecpay.queried_trade_nos == ["S1", "S1"]

    @pytest.mark.scenario("BILL-R22.5")
    def test_failed_termination_keeps_waiting(
        self, user: User, ecpay: FakeEcpay, monkeypatch: MonkeyPatch
    ) -> None:
        _subscribe(user, ecpay, monkeypatch, paid_at=_taipei_time(2026, 9, 20, 10, 0))
        ecpay.termination_rtn_code = TERMINATION_FAILED_RTN_CODE
        _freeze_time(monkeypatch, _taipei_time(2026, 10, 21, 3, 40))

        reconcile_due_billing_profiles()

        subscription = serialize_entitlements(user)
        assert ecpay.terminated_trade_nos == ["S1"]
        assert _get_profile(user).subscription_status == SubscriptionStatus.ACTIVE
        assert subscription["is_awaiting_renewal"] is True
        assert subscription["plan"] == Plan.STANDARD

    @pytest.mark.scenario("BILL-R22.6")
    def test_whitelisted_user_unpaid_period_ends_subscription(
        self, user: User, ecpay: FakeEcpay, monkeypatch: MonkeyPatch
    ) -> None:
        _subscribe(user, ecpay, monkeypatch, paid_at=_taipei_time(2026, 9, 20, 10, 0))
        StandardWhitelist.objects.create(user=user)
        _freeze_time(monkeypatch, _taipei_time(2026, 10, 21, 3, 40))

        reconcile_due_billing_profiles()

        subscription = serialize_entitlements(user)
        assert ecpay.terminated_trade_nos == ["S1"]
        assert _get_profile(user).subscription_status == SubscriptionStatus.CANCELED
        assert subscription["plan"] == Plan.STANDARD
        assert subscription["is_whitelisted"] is True

    @pytest.mark.scenario("BILL-R22.7")
    def test_order_ecpay_already_terminated_counts_as_terminated(
        self, user: User, ecpay: FakeEcpay, monkeypatch: MonkeyPatch
    ) -> None:
        _subscribe(user, ecpay, monkeypatch, paid_at=_taipei_time(2026, 9, 20, 10, 0))
        ecpay.termination_rtn_code = ORDER_DISABLED_RTN_CODE
        _freeze_time(monkeypatch, _taipei_time(2026, 10, 21, 3, 40))

        reconcile_due_billing_profiles()

        assert _get_profile(user).subscription_status == SubscriptionStatus.CANCELED

    def test_ecpay_error_on_one_subscription_does_not_stop_others(
        self, user: User, ecpay: FakeEcpay, monkeypatch: MonkeyPatch
    ) -> None:
        other_user = User.objects.create_user(
            oauth_org=OAuthOrganization.GOOGLE,
            oauth_id="other-oauth-id",
            email="other@example.com",
            username="Other User",
        )
        _subscribe(user, ecpay, monkeypatch, paid_at=_taipei_time(2026, 9, 20, 10, 0))
        _subscribe(
            other_user,
            ecpay,
            monkeypatch,
            paid_at=_taipei_time(2026, 9, 20, 11, 0),
            trade_no="S2",
        )
        ecpay.trade_no_to_query_error["S1"] = requests.ConnectionError()
        _freeze_time(monkeypatch, _taipei_time(2026, 10, 21, 3, 40))

        reconcile_due_billing_profiles()

        assert _get_profile(user).subscription_status == SubscriptionStatus.ACTIVE
        assert _get_profile(other_user).subscription_status == (
            SubscriptionStatus.CANCELED
        )

    def test_subscription_without_initial_payment_is_left_waiting(
        self, user: User, ecpay: FakeEcpay
    ) -> None:
        """
        Without its initial payment the backend cannot tell which ECPay order to
        query or terminate, and ending the subscription would leave ECPay charging.
        """
        period_ends_at = _taipei_time(2026, 10, 20, 10, 0)
        BillingProfile.objects.create(
            user=user,
            plan=Plan.STANDARD,
            subscription_status=SubscriptionStatus.ACTIVE,
            billing_interval=BillingInterval.MONTH,
            current_period_started_at=period_ends_at - timedelta(days=30),
            current_period_ends_at=period_ends_at,
        )

        reconcile_due_billing_profiles(now=_taipei_time(2026, 10, 21, 3, 40))

        assert _get_profile(user).subscription_status == SubscriptionStatus.ACTIVE
        assert ecpay.queried_trade_nos == []
        assert ecpay.terminated_trade_nos == []

    def test_charge_recorded_during_termination_keeps_paid_period(
        self, user: User, ecpay: FakeEcpay, monkeypatch: MonkeyPatch
    ) -> None:
        """
        The callback of this period's charge can arrive between the query and the
        termination. The user has paid for the period, but the terminated order will
        not charge again, so the subscription must end with that period.
        """
        order = _subscribe(
            user, ecpay, monkeypatch, paid_at=_taipei_time(2026, 9, 20, 10, 0)
        )
        _freeze_time(monkeypatch, _taipei_time(2026, 10, 21, 3, 40))
        ecpay.before_termination = lambda: process_period_payment_callback(
            _make_period_callback(order, total_success_times=2, gwsr="1002")
        )

        reconcile_due_billing_profiles()

        profile = _get_profile(user)
        assert profile.subscription_status == SubscriptionStatus.ACTIVE
        assert profile.current_period_ends_at == _taipei_time(2026, 11, 20, 10, 0)
        assert profile.cancel_at_period_end is True

    def test_charge_recorded_under_another_key_counts_as_recorded(
        self, user: User, ecpay: FakeEcpay, monkeypatch: MonkeyPatch
    ) -> None:
        """
        A callback without TotalSuccessTimes keys the charge by its Gwsr. The query
        must still see that charge as recorded, or every daily run would try to
        record it again and fail on the duplicate transaction number.
        """
        order = _subscribe(
            user, ecpay, monkeypatch, paid_at=_taipei_time(2026, 9, 20, 10, 0)
        )
        ecpay.add_charge("S1", gwsr="1002", process_date="2026/10/20 01:00:00")
        callback = _make_period_callback(order, total_success_times=2, gwsr="1002")
        del callback["TotalSuccessTimes"]
        _freeze_time(monkeypatch, _taipei_time(2026, 10, 20, 1, 0))
        process_period_payment_callback(callback)
        _freeze_time(monkeypatch, _taipei_time(2026, 11, 21, 3, 40))

        reconcile_due_billing_profiles()

        assert ecpay.terminated_trade_nos == ["S1"]
        assert _get_profile(user).subscription_status == SubscriptionStatus.CANCELED

    @pytest.mark.scenario("BILL-R10.13")
    def test_resubscribing_clears_failed_renewal(
        self, user: User, ecpay: FakeEcpay, monkeypatch: MonkeyPatch
    ) -> None:
        _subscribe(user, ecpay, monkeypatch, paid_at=_taipei_time(2026, 9, 20, 10, 0))
        _freeze_time(monkeypatch, _taipei_time(2026, 10, 21, 3, 40))
        reconcile_due_billing_profiles()
        _subscribe(
            user,
            ecpay,
            monkeypatch,
            paid_at=_taipei_time(2026, 10, 25, 10, 0),
            trade_no="S2",
        )
        stop_auto_renewal(user)
        _freeze_time(monkeypatch, _taipei_time(2026, 11, 26, 3, 40))

        reconcile_due_billing_profiles()

        subscription = serialize_entitlements(user)
        assert _get_profile(user).subscription_status == SubscriptionStatus.CANCELED
        assert subscription["plan"] == Plan.FREE
        assert subscription["ended_by_failed_renewal"] is False

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
class TestStopAutoRenewal:
    @pytest.mark.scenario("BILL-R23.10")
    def test_stop_in_waiting_period_after_unnotified_charge(
        self, user: User, ecpay: FakeEcpay, monkeypatch: MonkeyPatch
    ) -> None:
        _subscribe(user, ecpay, monkeypatch, paid_at=_taipei_time(2026, 9, 21, 10, 0))
        ecpay.add_charge("S1", gwsr="1002", process_date="2026/10/21 01:00:00")
        _freeze_time(monkeypatch, _taipei_time(2026, 10, 21, 15, 0))

        stop_auto_renewal(user)

        profile = _get_profile(user)
        assert ecpay.terminated_trade_nos == ["S1"]
        assert profile.subscription_status == SubscriptionStatus.ACTIVE
        assert profile.cancel_at_period_end is True
        assert profile.current_period_ends_at == _taipei_time(2026, 11, 21, 10, 0)

    @pytest.mark.scenario("BILL-R23.11", "BILL-R10.12")
    def test_stop_in_waiting_period_without_charge(
        self, user: User, ecpay: FakeEcpay, monkeypatch: MonkeyPatch
    ) -> None:
        _subscribe(user, ecpay, monkeypatch, paid_at=_taipei_time(2026, 9, 21, 10, 0))
        _freeze_time(monkeypatch, _taipei_time(2026, 10, 21, 15, 0))

        stop_auto_renewal(user)

        subscription = serialize_entitlements(user)
        assert ecpay.terminated_trade_nos == ["S1"]
        assert _get_profile(user).subscription_status == SubscriptionStatus.CANCELED
        assert subscription["plan"] == Plan.FREE
        assert subscription["ended_by_failed_renewal"] is False

    @pytest.mark.scenario("BILL-R23.14")
    def test_stop_when_ecpay_already_terminated_the_order(
        self, user: User, ecpay: FakeEcpay, monkeypatch: MonkeyPatch
    ) -> None:
        _subscribe(user, ecpay, monkeypatch, paid_at=_taipei_time(2026, 10, 21, 10, 0))
        ecpay.termination_rtn_code = ORDER_DISABLED_RTN_CODE
        _freeze_time(monkeypatch, _taipei_time(2026, 11, 1, 10, 0))

        stop_auto_renewal(user)

        profile = _get_profile(user)
        assert profile.cancel_at_period_end is True
        assert profile.current_period_ends_at == _taipei_time(2026, 11, 21, 10, 0)

    @pytest.mark.scenario("BILL-R23.15")
    def test_whitelisted_user_stop_in_waiting_period_without_charge(
        self, user: User, ecpay: FakeEcpay, monkeypatch: MonkeyPatch
    ) -> None:
        _subscribe(user, ecpay, monkeypatch, paid_at=_taipei_time(2026, 9, 21, 10, 0))
        StandardWhitelist.objects.create(user=user)
        _freeze_time(monkeypatch, _taipei_time(2026, 10, 21, 15, 0))

        stop_auto_renewal(user)

        subscription = serialize_entitlements(user)
        assert ecpay.terminated_trade_nos == ["S1"]
        assert _get_profile(user).subscription_status == SubscriptionStatus.CANCELED
        assert subscription["plan"] == Plan.STANDARD
        assert subscription["is_whitelisted"] is True

    def test_stop_without_initial_payment_fails(
        self, user: User, ecpay: FakeEcpay
    ) -> None:
        """
        Reporting success without terminating any ECPay order would let ECPay keep
        charging a user who stopped auto-renewal.
        """
        BillingProfile.objects.create(
            user=user,
            plan=Plan.STANDARD,
            subscription_status=SubscriptionStatus.ACTIVE,
            billing_interval=BillingInterval.MONTH,
            current_period_started_at=timezone.now() - timedelta(days=10),
            current_period_ends_at=timezone.now() + timedelta(days=20),
        )

        with pytest.raises(ValueError, match="no initial payment"):
            stop_auto_renewal(user)

        assert _get_profile(user).cancel_at_period_end is False
        assert ecpay.terminated_trade_nos == []

    @pytest.mark.scenario("BILL-R23.18")
    def test_stop_again_after_stopping(
        self, user: User, ecpay: FakeEcpay, monkeypatch: MonkeyPatch
    ) -> None:
        _subscribe(user, ecpay, monkeypatch, paid_at=_taipei_time(2026, 10, 21, 10, 0))
        _freeze_time(monkeypatch, _taipei_time(2026, 11, 1, 10, 0))
        stop_auto_renewal(user)
        assert ecpay.terminated_trade_nos == ["S1"]
        ecpay.terminated_trade_nos.clear()

        stop_auto_renewal(user)

        profile = _get_profile(user)
        assert ecpay.terminated_trade_nos == []
        assert profile.cancel_at_period_end is True
        assert profile.current_period_ends_at == _taipei_time(2026, 11, 21, 10, 0)


@pytest.mark.django_db
class TestPaymentWhileAutoRenewing:
    @pytest.mark.scenario("BILL-R27.1")
    def test_extra_payment_is_paid_and_its_order_terminated(
        self, user: User, ecpay: FakeEcpay, monkeypatch: MonkeyPatch
    ) -> None:
        monthly = _subscribe(
            user, ecpay, monkeypatch, paid_at=_taipei_time(2026, 10, 21, 10, 0)
        )

        yearly = _pay(
            user,
            monkeypatch,
            paid_at=_taipei_time(2026, 10, 21, 10, 5),
            interval=BillingInterval.YEAR,
            trade_no="S2",
        )

        profile = _get_profile(user)
        assert yearly.status == PaymentStatus.PAID
        assert yearly.provider_subscription_termination_pending is False
        assert ecpay.terminated_trade_nos == ["S2"]
        assert profile.billing_interval == BillingInterval.MONTH
        assert profile.initial_payment_id == monthly.pk
        assert profile.current_period_ends_at == _taipei_time(2026, 11, 21, 10, 0)

    @pytest.mark.scenario("BILL-R27.2")
    def test_failed_termination_is_retried_daily(
        self, user: User, ecpay: FakeEcpay, monkeypatch: MonkeyPatch
    ) -> None:
        _subscribe(user, ecpay, monkeypatch, paid_at=_taipei_time(2026, 10, 21, 10, 0))
        ecpay.termination_rtn_code = TERMINATION_FAILED_RTN_CODE
        yearly = _pay(
            user,
            monkeypatch,
            paid_at=_taipei_time(2026, 10, 21, 10, 5),
            interval=BillingInterval.YEAR,
            trade_no="S2",
        )
        assert yearly.provider_subscription_termination_pending is True

        terminate_pending_provider_subscriptions()

        assert ecpay.terminated_trade_nos == ["S2", "S2"]

    @pytest.mark.scenario("BILL-R27.3")
    def test_retry_stops_once_ecpay_reports_order_terminated(
        self, user: User, ecpay: FakeEcpay, monkeypatch: MonkeyPatch
    ) -> None:
        _subscribe(user, ecpay, monkeypatch, paid_at=_taipei_time(2026, 10, 21, 10, 0))
        ecpay.termination_rtn_code = TERMINATION_FAILED_RTN_CODE
        _pay(
            user,
            monkeypatch,
            paid_at=_taipei_time(2026, 10, 21, 10, 5),
            interval=BillingInterval.YEAR,
            trade_no="S2",
        )
        ecpay.termination_rtn_code = ORDER_DISABLED_RTN_CODE
        terminate_pending_provider_subscriptions()
        assert ecpay.terminated_trade_nos == ["S2", "S2"]
        ecpay.terminated_trade_nos.clear()

        terminate_pending_provider_subscriptions()

        assert ecpay.terminated_trade_nos == []

    @pytest.mark.scenario("BILL-R27.4")
    def test_stop_terminates_the_subscriptions_own_order(
        self, user: User, ecpay: FakeEcpay, monkeypatch: MonkeyPatch
    ) -> None:
        _subscribe(user, ecpay, monkeypatch, paid_at=_taipei_time(2026, 10, 21, 10, 0))
        _pay(
            user,
            monkeypatch,
            paid_at=_taipei_time(2026, 10, 21, 10, 5),
            interval=BillingInterval.YEAR,
            trade_no="S2",
        )
        ecpay.terminated_trade_nos.clear()

        stop_auto_renewal(user)

        profile = _get_profile(user)
        assert ecpay.terminated_trade_nos == ["S1"]
        assert profile.cancel_at_period_end is True
        assert profile.current_period_ends_at == _taipei_time(2026, 11, 21, 10, 0)


@pytest.mark.django_db
class TestSubscriptionPaymentLifecycle:
    @pytest.mark.scenario("BILL-R17.1")
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

    @pytest.mark.scenario("BILL-R18.1")
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

    @pytest.mark.scenario("BILL-R18.3")
    def test_whitelisted_user_cannot_start_subscription(self, user: User) -> None:
        BillingProfile.objects.create(
            user=user,
            plan=Plan.FREE,
            subscription_status=SubscriptionStatus.CANCELED,
            trial_started_at=timezone.now() - timedelta(days=40),
            trial_ends_at=timezone.now() - timedelta(days=9),
        )
        StandardWhitelist.objects.create(user=user)
        client = FakeEcpayClient()

        with pytest.raises(
            SubscriptionPaymentNotChargeableError,
            match="User is on the Standard whitelist",
        ):
            create_subscription_checkout(
                user=user, interval=BillingInterval.MONTH, client=client
            )

        assert client.calls == 0
        assert not SubscriptionPayment.objects.filter(user=user).exists()

    @pytest.mark.scenario("BILL-R18.4")
    def test_subscription_in_waiting_period_cannot_be_started_again(
        self, user: User
    ) -> None:
        BillingProfile.objects.create(
            user=user,
            plan=Plan.STANDARD,
            subscription_status=SubscriptionStatus.ACTIVE,
            billing_interval=BillingInterval.MONTH,
            current_period_started_at=timezone.now() - timedelta(days=31),
            current_period_ends_at=timezone.now() - timedelta(hours=1),
        )
        client = FakeEcpayClient()

        with pytest.raises(SubscriptionPaymentNotChargeableError):
            create_subscription_checkout(
                user=user, interval=BillingInterval.MONTH, client=client
            )

        assert client.calls == 0
        assert not SubscriptionPayment.objects.filter(user=user).exists()

    @pytest.mark.scenario("BILL-R17.1")
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

    @pytest.mark.scenario("BILL-R14.3")
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

    @pytest.mark.scenario("BILL-R16.3")
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

    @pytest.mark.scenario("BILL-R16.2")
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

    @pytest.mark.scenario("BILL-R16.4")
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
