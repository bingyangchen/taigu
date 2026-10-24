from datetime import timedelta
from io import StringIO

import pytest
from django.core.management import CommandError, call_command
from django.utils import timezone

from main.account import OAuthOrganization
from main.account.models import User
from main.billing.models import (
    BillingInterval,
    BillingProfile,
    Plan,
    StandardWhitelist,
    SubscriptionStatus,
)
from main.billing.services.entitlements import _get_entitlements


def _run_command(*args: str) -> str:
    stdout = StringIO()
    call_command("standard_whitelist", *args, stdout=stdout)
    return stdout.getvalue()


@pytest.mark.django_db
class TestStandardWhitelistCommand:
    @pytest.fixture
    def user(self) -> User:
        return User.objects.create_user(
            oauth_org=OAuthOrganization.GOOGLE,
            oauth_id="oauth-id",
            email="test@example.com",
            username="Test User",
        )

    @pytest.fixture
    def free_profile(self, user: User) -> BillingProfile:
        return BillingProfile.objects.create(
            user=user,
            plan=Plan.FREE,
            subscription_status=SubscriptionStatus.CANCELED,
            trial_started_at=timezone.now() - timedelta(days=40),
            trial_ends_at=timezone.now() - timedelta(days=9),
        )

    @pytest.mark.scenario("BILL-R25.1")
    def test_add_makes_free_user_standard(
        self, user: User, free_profile: BillingProfile
    ) -> None:
        _run_command("add", user.email, "--note", "Beta tester")

        entry = StandardWhitelist.objects.get(user=user)
        entitlements = _get_entitlements(user)
        assert entry.note == "Beta tester"
        assert entitlements.plan == Plan.STANDARD
        assert entitlements.is_whitelisted is True

    @pytest.mark.scenario("BILL-R25.2")
    def test_remove_makes_free_user_free(
        self, user: User, free_profile: BillingProfile
    ) -> None:
        StandardWhitelist.objects.create(user=user)

        _run_command("remove", str(user.id))

        entitlements = _get_entitlements(user)
        assert not StandardWhitelist.objects.filter(user=user).exists()
        assert entitlements.plan == Plan.FREE
        assert entitlements.is_whitelisted is False

    @pytest.mark.scenario("BILL-R26.1")
    def test_add_keeps_auto_renewing_subscription(self, user: User) -> None:
        period_ends_at = timezone.now() + timedelta(days=28)
        BillingProfile.objects.create(
            user=user,
            plan=Plan.STANDARD,
            subscription_status=SubscriptionStatus.ACTIVE,
            billing_interval=BillingInterval.MONTH,
            current_period_started_at=period_ends_at - timedelta(days=31),
            current_period_ends_at=period_ends_at,
        )

        _run_command("add", user.email)

        profile = BillingProfile.objects.get(user=user)
        assert profile.subscription_status == SubscriptionStatus.ACTIVE
        assert profile.cancel_at_period_end is False
        assert profile.current_period_ends_at == period_ends_at

    @pytest.mark.scenario("BILL-R26.3")
    def test_remove_keeps_trial(self, user: User) -> None:
        trial_ends_at = timezone.now() + timedelta(days=28)
        BillingProfile.objects.create(
            user=user,
            plan=Plan.STANDARD,
            subscription_status=SubscriptionStatus.TRIALING,
            trial_started_at=trial_ends_at - timedelta(days=31),
            trial_ends_at=trial_ends_at,
        )
        StandardWhitelist.objects.create(user=user)

        _run_command("remove", user.email)

        profile = BillingProfile.objects.get(user=user)
        assert profile.subscription_status == SubscriptionStatus.TRIALING
        assert profile.trial_ends_at == trial_ends_at
        assert _get_entitlements(user).plan == Plan.STANDARD

    def test_add_warns_that_ecpay_keeps_charging_auto_renewing_user(
        self, user: User
    ) -> None:
        """
        Adding a user does not cancel the ECPay periodic order (BILL-R26), so the
        developer must ask the user to stop auto-renewal.
        """
        BillingProfile.objects.create(
            user=user,
            plan=Plan.STANDARD,
            subscription_status=SubscriptionStatus.ACTIVE,
            current_period_started_at=timezone.now() - timedelta(days=3),
            current_period_ends_at=timezone.now() + timedelta(days=28),
        )

        output = _run_command("add", user.email)

        assert "ECPay will keep charging the user" in output

    def test_add_warns_that_ecpay_may_keep_charging_past_due_user(
        self, user: User
    ) -> None:
        """
        A past-due user cannot stop auto-renewal on the plan page, so the developer
        has to handle the ECPay periodic order some other way.
        """
        BillingProfile.objects.create(
            user=user,
            plan=Plan.STANDARD,
            subscription_status=SubscriptionStatus.PAST_DUE,
            current_period_started_at=timezone.now() - timedelta(days=33),
            current_period_ends_at=timezone.now() - timedelta(days=2),
        )

        output = _run_command("add", user.email)

        assert "ECPay may keep charging the user" in output

    def test_add_does_not_warn_after_past_due_user_stopped_auto_renewal(
        self, user: User
    ) -> None:
        """
        Stopping auto-renewal already canceled the ECPay periodic order, so a
        warning would send the developer after a charge that cannot happen.
        """
        BillingProfile.objects.create(
            user=user,
            plan=Plan.STANDARD,
            subscription_status=SubscriptionStatus.PAST_DUE,
            current_period_started_at=timezone.now() - timedelta(days=33),
            current_period_ends_at=timezone.now() - timedelta(days=2),
            cancel_at_period_end=True,
        )

        output = _run_command("add", user.email)

        assert "ECPay" not in output

    def test_add_does_not_warn_for_free_user(
        self, user: User, free_profile: BillingProfile
    ) -> None:
        output = _run_command("add", user.email)

        assert "ECPay" not in output

    def test_add_rejects_unknown_user(self) -> None:
        with pytest.raises(CommandError, match="No user found"):
            _run_command("add", "nobody@example.com")

        assert not StandardWhitelist.objects.exists()

    def test_add_rejects_user_already_on_whitelist(self, user: User) -> None:
        StandardWhitelist.objects.create(user=user, note="Original note")

        with pytest.raises(CommandError, match="already on the Standard whitelist"):
            _run_command("add", user.email, "--note", "New note")

        assert StandardWhitelist.objects.get(user=user).note == "Original note"

    def test_remove_rejects_user_not_on_whitelist(self, user: User) -> None:
        with pytest.raises(CommandError, match="not on the Standard whitelist"):
            _run_command("remove", user.email)

    def test_list_shows_each_entry(self, user: User) -> None:
        StandardWhitelist.objects.create(user=user, note="Beta tester")

        output = _run_command("list")

        row = output.splitlines()[1].split("\t")
        assert row[:4] == [str(user.id), user.email, user.username, "Beta tester"]
