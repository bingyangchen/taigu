from dataclasses import asdict, dataclass
from datetime import datetime, timedelta
from typing import Literal

from django.db.models import Sum
from django.http import JsonResponse
from django.utils import timezone

from main.account.models import User
from main.billing.models import BillingProfile, Plan, SubscriptionStatus
from main.cash_dividend.models import CashDividendRecord
from main.favorite.models import Favorite
from main.trade_plan.models import TradePlan
from main.trade_record.models import TradeRecord

Resource = Literal["records", "trade_plans", "holdings", "favorites"]


@dataclass(frozen=True)
class Quota:
    monthly_records: int | None
    monthly_trade_plans: int | None
    holdings: int | None
    favorites: int | None


@dataclass(frozen=True)
class Usage:
    monthly_records: int
    monthly_trade_plans: int
    holdings: int
    favorites: int


@dataclass(frozen=True)
class Entitlements:
    plan: str
    status: str
    billing_interval: str
    trial_ends_at: str | None
    current_period_ends_at: str | None
    cancel_at_period_end: bool
    market_refresh_interval_seconds: int
    quota: Quota
    usage: Usage


FREE_QUOTA = Quota(
    monthly_records=20, monthly_trade_plans=10, holdings=10, favorites=10
)
STANDARD_QUOTA = Quota(
    monthly_records=None, monthly_trade_plans=None, holdings=None, favorites=None
)
TRIAL_LENGTH = timedelta(days=31)


class QuotaExceededError(Exception):
    def __init__(self, resource: Resource, message: str) -> None:
        self.resource = resource
        self.message = message
        super().__init__(message)

    def to_response(self) -> JsonResponse:
        return JsonResponse(
            {
                "code": "QUOTA_EXCEEDED",
                "resource": self.resource,
                "message": self.message,
            },
            status=402,
        )


def ensure_billing_profile(user: User) -> BillingProfile:
    now = timezone.now()
    profile, created = BillingProfile.objects.get_or_create(
        user=user,
        defaults={
            "plan": Plan.STANDARD,
            "subscription_status": SubscriptionStatus.TRIALING,
            "trial_started_at": now,
            "trial_ends_at": now + TRIAL_LENGTH,
        },
    )
    if created:
        return profile

    if (
        profile.subscription_status == SubscriptionStatus.TRIALING
        and profile.trial_ends_at
        and profile.trial_ends_at <= now
    ):
        profile.plan = Plan.FREE
        profile.subscription_status = SubscriptionStatus.CANCELED
        profile.save()
    return profile


def is_standard_subscription_active(
    profile: BillingProfile, *, now: datetime | None = None
) -> bool:
    now = now or timezone.now()
    return (
        profile.plan == Plan.STANDARD
        and profile.subscription_status == SubscriptionStatus.ACTIVE
        and profile.current_period_ends_at is not None
        and profile.current_period_ends_at > now
    )


def _get_effective_plan(profile: BillingProfile) -> Plan:
    now = timezone.now()
    if (
        profile.plan == Plan.STANDARD
        and profile.subscription_status == SubscriptionStatus.TRIALING
        and profile.trial_ends_at
        and profile.trial_ends_at > now
    ):
        return Plan.STANDARD

    if is_standard_subscription_active(profile, now=now):
        return Plan.STANDARD

    return Plan.FREE


def _get_monthly_period_start() -> datetime:
    now = timezone.localtime()
    return now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)


def _get_usage(user: User) -> Usage:
    monthly_period_start = _get_monthly_period_start()
    record_count = (
        TradeRecord.objects.filter(
            owner=user, created_at__gte=monthly_period_start
        ).count()
        + CashDividendRecord.objects.filter(
            owner=user, created_at__gte=monthly_period_start
        ).count()
    )
    trade_plan_count = TradePlan.objects.filter(
        owner=user, created_at__gte=monthly_period_start
    ).count()
    return Usage(
        monthly_records=record_count,
        monthly_trade_plans=trade_plan_count,
        holdings=len(_get_holding_sids(user)),
        favorites=Favorite.objects.filter(owner=user).count(),
    )


def _get_entitlements(user: User) -> Entitlements:
    profile = ensure_billing_profile(user)
    effective_plan = _get_effective_plan(profile)
    quota = STANDARD_QUOTA if effective_plan == Plan.STANDARD else FREE_QUOTA
    return Entitlements(
        plan=effective_plan,
        status=profile.subscription_status,
        billing_interval=profile.billing_interval,
        trial_ends_at=profile.trial_ends_at.isoformat()
        if profile.trial_ends_at
        else None,
        current_period_ends_at=(
            profile.current_period_ends_at.isoformat()
            if profile.current_period_ends_at
            else None
        ),
        cancel_at_period_end=profile.cancel_at_period_end,
        market_refresh_interval_seconds=30 if effective_plan == Plan.STANDARD else 600,
        quota=quota,
        usage=_get_usage(user),
    )


def serialize_entitlements(user: User) -> dict:
    entitlements = _get_entitlements(user)
    return {
        "plan": entitlements.plan,
        "status": entitlements.status,
        "billing_interval": entitlements.billing_interval,
        "trial_ends_at": entitlements.trial_ends_at,
        "current_period_ends_at": entitlements.current_period_ends_at,
        "cancel_at_period_end": entitlements.cancel_at_period_end,
        "market_refresh_interval_seconds": entitlements.market_refresh_interval_seconds,
        "quota": asdict(entitlements.quota),
        "usage": asdict(entitlements.usage),
    }


def serialize_account_subscription(user: User) -> dict:
    profile = ensure_billing_profile(user)
    effective_plan = _get_effective_plan(profile)
    return {
        "plan": effective_plan,
        "market_refresh_interval_seconds": 30
        if effective_plan == Plan.STANDARD
        else 600,
    }


def assert_can_create_trade_record(user: User) -> None:
    _assert_can_create_monthly_record(user)


def assert_can_create_cash_dividend_record(user: User) -> None:
    _assert_can_create_monthly_record(user)


def _assert_can_create_monthly_record(user: User) -> None:
    entitlements = _get_entitlements(user)
    quota = entitlements.quota.monthly_records
    if quota is not None and entitlements.usage.monthly_records >= quota:
        raise QuotaExceededError(
            "records", "Free 方案每月可新增 20 筆交易紀錄與現金股利。"
        )


def assert_can_create_trade_plan(user: User) -> None:
    entitlements = _get_entitlements(user)
    quota = entitlements.quota.monthly_trade_plans
    if quota is not None and entitlements.usage.monthly_trade_plans >= quota:
        raise QuotaExceededError("trade_plans", "Free 方案每月可新增 10 筆買賣計畫。")


def assert_can_add_favorite(user: User, sid: str) -> None:
    if Favorite.objects.filter(owner=user, company_id=sid).exists():
        # NOTE: For idempotency
        return
    entitlements = _get_entitlements(user)
    quota = entitlements.quota.favorites
    if quota is not None and entitlements.usage.favorites >= quota:
        raise QuotaExceededError("favorites", "Free 方案最多可關注 10 檔股票。")


def assert_can_add_holding(user: User, sid: str, quantity_delta: int) -> None:
    if quantity_delta <= 0:
        return
    holding_sids = _get_holding_sids(user)
    if sid in holding_sids:
        return
    entitlements = _get_entitlements(user)
    quota = entitlements.quota.holdings
    if quota is not None and len(holding_sids) >= quota:
        raise QuotaExceededError("holdings", "Free 方案最多可持有 10 檔股票。")


def _get_holding_sids(user: User) -> set[str]:
    rows = (
        TradeRecord.objects.filter(owner=user)
        .values("company_id")
        .annotate(total_quantity=Sum("deal_quantity"))
        .filter(total_quantity__gt=0)
    )
    return {row["company_id"] for row in rows}
