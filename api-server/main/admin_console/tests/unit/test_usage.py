from datetime import UTC, date, datetime, time
from zoneinfo import ZoneInfo

import pytest

from main.account import OAuthOrganization
from main.account.models import User
from main.admin_console.services.usage import (
    ChartRange,
    get_daily_usage,
    get_recording_start,
    get_retention,
    get_usage_summary,
)
from main.usage.models import DailyActivity, Platform

TAIPEI = ZoneInfo("Asia/Taipei")
LONG_AGO = date(2026, 1, 1)


def _create_user(name: str, joined_on: date = LONG_AGO) -> User:
    return User.objects.create_user(
        oauth_org=OAuthOrganization.GOOGLE,
        oauth_id=name,
        email=f"{name}@example.com",
        username=name,
        date_joined=datetime.combine(joined_on, time(12), tzinfo=TAIPEI),
    )


def _create_users(prefix: str, count: int, joined_on: date = LONG_AGO) -> list[User]:
    return [_create_user(f"{prefix}{i}", joined_on) for i in range(count)]


def _record(user: User, *days: date, platform: str | None = Platform.WEB) -> None:
    for day in days:
        DailyActivity.objects.create(user=user, date=day, platform=platform)


def _get_summary(today: date) -> dict:
    recording_start = get_recording_start()
    return get_usage_summary(
        today,
        recording_start,
        get_daily_usage(today, recording_start, ChartRange.NINETY_DAYS),
    )


def _get_day(days: list[dict], day: date) -> dict:
    return next(d for d in days if d["date"] == day.isoformat())


def _get_week(weeks: list[dict], monday: date) -> dict:
    return next(w for w in weeks if w["week_start"] == monday.isoformat())


@pytest.mark.django_db
class TestStatisticDefinitions:
    @pytest.mark.scenario("ADMIN-R5.1")
    def test_one_user_on_several_platforms_counts_once(self) -> None:
        user = _create_user("a")
        _record(user, date(2026, 12, 9), platform=Platform.WEB)
        _record(user, date(2026, 12, 9), platform=Platform.PWA)
        _record(user, date(2026, 12, 9), platform=None)

        summary = _get_summary(date(2026, 12, 10))

        assert summary["dau"]["value"] == 1

    @pytest.mark.scenario("ADMIN-R5.2")
    def test_signup_day_uses_taiwan_time(self) -> None:
        _record(_create_user("c"), date(2026, 12, 1))
        User.objects.create_user(
            oauth_org=OAuthOrganization.GOOGLE,
            oauth_id="b",
            email="b@example.com",
            username="b",
            date_joined=datetime(2026, 12, 8, 17, 30, tzinfo=UTC),
        )

        days = get_daily_usage(
            date(2026, 12, 10), get_recording_start(), ChartRange.ALL
        )

        assert _get_day(days, date(2026, 12, 9))["signups"] == 1
        assert _get_day(days, date(2026, 12, 8))["signups"] == 0

    @pytest.mark.scenario("ADMIN-R5.3")
    def test_deleted_user_leaves_past_days(self) -> None:
        user_a = _create_user("a")
        _record(user_a, date(2026, 12, 1))
        _record(_create_user("c"), date(2026, 12, 1))
        user_a.delete()

        days = get_daily_usage(
            date(2026, 12, 10), get_recording_start(), ChartRange.ALL
        )

        assert _get_day(days, date(2026, 12, 1))["dau"] == 1

    @pytest.mark.scenario("ADMIN-R5.4")
    def test_superuser_counts(self) -> None:
        superuser = _create_user("dev")
        superuser.is_superuser = True
        superuser.save()
        _record(superuser, date(2026, 12, 9))

        summary = _get_summary(date(2026, 12, 10))

        assert summary["dau"]["value"] == 1


@pytest.mark.django_db
class TestUsageSummary:
    TODAY = date(2026, 12, 10)

    def _record_dau(self, count_on_week_ago: int, count_on_yesterday: int) -> None:
        _record(_create_user("first"), date(2026, 11, 1))
        users = _create_users("u", max(count_on_week_ago, count_on_yesterday))
        for user in users[:count_on_week_ago]:
            _record(user, date(2026, 12, 2))
        for user in users[:count_on_yesterday]:
            _record(user, date(2026, 12, 9))

    @pytest.mark.scenario("ADMIN-R6.1")
    def test_summary_numbers(self) -> None:
        user_a, user_b, user_c, user_d, user_e = _create_users("u", 5)
        _record(user_a, date(2026, 12, 9))
        _record(user_b, date(2026, 12, 9), date(2026, 12, 4))
        _record(user_c, date(2026, 12, 4))
        _record(user_d, date(2026, 11, 12))
        _record(user_e, date(2026, 11, 1))
        _create_users("other", 407)

        summary = _get_summary(self.TODAY)

        assert summary["dau"]["value"] == 2
        assert summary["wau"]["value"] == 3
        assert summary["mau"]["value"] == 4
        assert summary["registered"]["value"] == 412

    @pytest.mark.scenario("ADMIN-R6.2")
    def test_today_is_left_out(self) -> None:
        _record(_create_user("first"), date(2026, 11, 1))
        user_a = _create_user("a")
        _record(user_a, date(2026, 12, 9), date(2026, 12, 10))
        _record(_create_user("f", joined_on=self.TODAY), self.TODAY)
        _create_users("other", 410)

        summary = _get_summary(self.TODAY)

        assert summary["dau"]["value"] == 1
        assert summary["wau"]["value"] == 1
        assert summary["mau"]["value"] == 1
        assert summary["registered"]["value"] == 412

    @pytest.mark.scenario("ADMIN-R6.3")
    def test_decrease_from_week_ago(self) -> None:
        self._record_dau(count_on_week_ago=5, count_on_yesterday=2)

        summary = _get_summary(self.TODAY)

        assert summary["compared_with"] == "2026-12-02"
        assert summary["dau"] == {"value": 2, "change": -3}

    @pytest.mark.scenario("ADMIN-R6.4")
    def test_no_change_from_week_ago(self) -> None:
        self._record_dau(count_on_week_ago=2, count_on_yesterday=2)

        summary = _get_summary(self.TODAY)

        assert summary["dau"] == {"value": 2, "change": 0}

    @pytest.mark.scenario("ADMIN-R6.11")
    def test_increase_from_week_ago(self) -> None:
        self._record_dau(count_on_week_ago=2, count_on_yesterday=5)

        summary = _get_summary(self.TODAY)

        assert summary["dau"] == {"value": 5, "change": 3}

    @pytest.mark.scenario("ADMIN-R6.5")
    def test_yesterday_before_recording_start(self) -> None:
        _create_user("recent", joined_on=date(2026, 12, 5))
        _record(_create_user("a"), self.TODAY)

        summary = _get_summary(self.TODAY)

        assert summary["dau"] is None
        assert summary["wau"] is None
        assert summary["mau"] is None
        assert summary["registered"] == {"value": 2, "change": 1}

    @pytest.mark.scenario("ADMIN-R6.6")
    def test_no_usage_records(self) -> None:
        _create_user("a")

        summary = _get_summary(self.TODAY)

        assert summary["dau"] is None
        assert summary["wau"] is None
        assert summary["mau"] is None
        assert summary["registered"] == {"value": 1, "change": 0}

    @pytest.mark.scenario("ADMIN-R6.7")
    def test_yesterday_is_recording_start(self) -> None:
        _record(_create_user("a"), date(2026, 12, 9))

        summary = _get_summary(self.TODAY)

        for name in ("dau", "wau", "mau"):
            assert summary[name] == {"value": 1, "change": None}

    @pytest.mark.scenario("ADMIN-R6.8")
    def test_week_ago_before_recording_start(self) -> None:
        _record(_create_user("a"), date(2026, 12, 5), date(2026, 12, 9))

        summary = _get_summary(self.TODAY)

        for name in ("dau", "wau", "mau"):
            assert summary[name]["value"] == 1
            assert summary[name]["change"] is None
        assert summary["registered"]["change"] is not None

    @pytest.mark.scenario("ADMIN-R6.9")
    def test_week_ago_is_recording_start(self) -> None:
        _record(_create_user("a"), date(2026, 12, 2))

        summary = _get_summary(self.TODAY)

        assert summary["dau"] == {"value": 0, "change": -1}
        assert summary["wau"] == {"value": 0, "change": -1}
        assert summary["mau"] == {"value": 1, "change": 0}

    @pytest.mark.scenario("ADMIN-R6.10")
    def test_window_partly_before_recording_start(self) -> None:
        _record(_create_user("a"), date(2026, 12, 1))
        _record(_create_user("b"), date(2026, 12, 9))

        summary = _get_summary(self.TODAY)

        assert summary["mau"]["value"] == 2


@pytest.mark.django_db
class TestDailyUsage:
    TODAY = date(2026, 12, 10)

    @pytest.mark.scenario("ADMIN-R7.1")
    def test_ninety_days_by_default_and_all(self) -> None:
        _record(_create_user("a"), date(2026, 6, 1))

        ninety_days = get_daily_usage(
            self.TODAY, get_recording_start(), ChartRange.NINETY_DAYS
        )
        all_days = get_daily_usage(self.TODAY, get_recording_start(), ChartRange.ALL)

        assert ninety_days[0]["date"] == "2026-09-12"
        assert ninety_days[-1]["date"] == "2026-12-10"
        assert len(ninety_days) == 90
        assert all_days[0]["date"] == "2026-06-01"
        assert all_days[-1]["date"] == "2026-12-10"

    @pytest.mark.scenario("ADMIN-R7.2")
    def test_fewer_than_ninety_days_of_records(self) -> None:
        _record(_create_user("a"), date(2026, 11, 1))

        days = get_daily_usage(
            self.TODAY, get_recording_start(), ChartRange.NINETY_DAYS
        )

        assert days[0]["date"] == "2026-11-01"
        assert days[-1]["date"] == "2026-12-10"

    @pytest.mark.scenario("ADMIN-R7.3")
    def test_ninety_days_start_on_recording_start(self) -> None:
        _record(_create_user("a"), date(2026, 9, 12))

        days = get_daily_usage(
            self.TODAY, get_recording_start(), ChartRange.NINETY_DAYS
        )

        assert days[0]["date"] == "2026-09-12"
        assert len(days) == 90

    @pytest.mark.scenario("ADMIN-R7.5")
    def test_incomplete_days(self) -> None:
        _record(_create_user("a"), date(2026, 11, 1))

        days = get_daily_usage(
            self.TODAY, get_recording_start(), ChartRange.NINETY_DAYS
        )

        assert _get_day(days, date(2026, 11, 1))["is_incomplete"] is True
        assert _get_day(days, date(2026, 11, 29))["is_incomplete"] is True
        assert _get_day(days, date(2026, 11, 30))["is_incomplete"] is False
        assert days[-1]["is_incomplete"] is False

    @pytest.mark.scenario("ADMIN-R7.6")
    def test_seven_day_window(self) -> None:
        _record(_create_user("a"), date(2026, 12, 1))
        _record(_create_user("b"), date(2026, 12, 7))

        days = get_daily_usage(
            self.TODAY, get_recording_start(), ChartRange.NINETY_DAYS
        )

        assert _get_day(days, date(2026, 12, 7))["wau"] == 2
        assert _get_day(days, date(2026, 12, 8))["wau"] == 1

    def test_no_usage_records(self) -> None:
        assert (
            get_daily_usage(self.TODAY, get_recording_start(), ChartRange.NINETY_DAYS)
            == []
        )


@pytest.mark.django_db
class TestRetention:
    LATER = date(2027, 1, 10)
    WEEK = date(2026, 11, 2)

    @pytest.fixture(autouse=True)
    def recording_started(self) -> None:
        _record(_create_user("first"), date(2026, 11, 1))

    def _count(self, today: date, name: str) -> int | None:
        return _get_week(get_retention(today, get_recording_start()), self.WEEK)[name][
            "count"
        ]

    @pytest.mark.scenario("ADMIN-R8.1")
    def test_day_1_and_day_7_ranges(self) -> None:
        _record(_create_user("a", self.WEEK), date(2026, 11, 3), date(2026, 11, 9))

        assert self._count(self.LATER, "day_1") == 1
        assert self._count(self.LATER, "day_7") == 1
        assert self._count(self.LATER, "day_30") == 0

    @pytest.mark.scenario("ADMIN-R8.2")
    def test_signup_day_does_not_count(self) -> None:
        _record(_create_user("a", self.WEEK), self.WEEK)

        assert self._count(self.LATER, "day_1") == 0
        assert self._count(self.LATER, "day_7") == 0
        assert self._count(self.LATER, "day_30") == 0

    @pytest.mark.scenario("ADMIN-R8.3")
    def test_day_6_and_day_14(self) -> None:
        _record(_create_user("a", self.WEEK), date(2026, 11, 8), date(2026, 11, 16))

        assert self._count(self.LATER, "day_1") == 1
        assert self._count(self.LATER, "day_7") == 0

    @pytest.mark.scenario("ADMIN-R8.4")
    def test_day_13(self) -> None:
        _record(_create_user("a", self.WEEK), date(2026, 11, 15))

        assert self._count(self.LATER, "day_1") == 0
        assert self._count(self.LATER, "day_7") == 1

    @pytest.mark.scenario("ADMIN-R8.5")
    def test_day_30_and_day_36(self) -> None:
        _record(_create_user("a", self.WEEK), date(2026, 12, 2))
        _record(_create_user("b", self.WEEK), date(2026, 12, 8))

        assert self._count(self.LATER, "day_30") == 2

    @pytest.mark.scenario("ADMIN-R8.6")
    def test_day_29_and_day_37(self) -> None:
        _record(_create_user("a", self.WEEK), date(2026, 12, 1), date(2026, 12, 9))

        assert self._count(self.LATER, "day_30") == 0

    @pytest.mark.scenario("ADMIN-R8.7")
    def test_percent(self) -> None:
        users = _create_users("u", 12, self.WEEK)
        for user in users[:7]:
            _record(user, date(2026, 11, 3))

        week = _get_week(get_retention(self.LATER, get_recording_start()), self.WEEK)

        assert week["signups"] == 12
        assert week["day_1"] == {"status": "complete", "count": 7, "percent": 58}

    @pytest.mark.scenario("ADMIN-R8.8")
    def test_percent_rounds_half_up(self) -> None:
        users = _create_users("u", 8, self.WEEK)
        _record(users[0], date(2026, 11, 3))

        week = _get_week(get_retention(self.LATER, get_recording_start()), self.WEEK)

        assert week["day_1"] == {"status": "complete", "count": 1, "percent": 13}

    @pytest.mark.scenario("ADMIN-R8.9")
    def test_in_progress_cells(self) -> None:
        _create_users("w1-", 5, date(2026, 11, 23))
        _create_users("w2-", 5, date(2026, 11, 30))
        _create_users("w3-", 2, date(2026, 12, 7))

        weeks = get_retention(date(2026, 12, 10), get_recording_start())

        assert weeks[0]["week_start"] == "2026-12-07"
        assert weeks[0]["signups"] == 2
        for week_start, in_progress_cells in [
            ("2026-12-07", ["day_1", "day_7", "day_30"]),
            ("2026-11-30", ["day_1", "day_7", "day_30"]),
            ("2026-11-23", ["day_7", "day_30"]),
        ]:
            week = _get_week(weeks, date.fromisoformat(week_start))
            for name in ["day_1", "day_7", "day_30"]:
                expected = "in_progress" if name in in_progress_cells else "complete"
                assert week[name]["status"] == expected

    @pytest.mark.scenario("ADMIN-R8.10")
    def test_range_ends_today(self) -> None:
        _create_users("u", 5, date(2026, 11, 23))

        week = _get_week(
            get_retention(date(2026, 12, 5), get_recording_start()), date(2026, 11, 23)
        )

        assert week["day_1"]["status"] == "in_progress"

    @pytest.mark.scenario("ADMIN-R8.11")
    def test_range_ends_yesterday(self) -> None:
        _create_users("u", 5, date(2026, 11, 23))

        week = _get_week(
            get_retention(date(2026, 12, 6), get_recording_start()), date(2026, 11, 23)
        )

        assert week["day_1"]["status"] == "complete"
        assert week["day_1"]["count"] == 0

    @pytest.mark.scenario("ADMIN-R8.14")
    def test_week_without_signups(self) -> None:
        week = _get_week(
            get_retention(date(2026, 12, 10), get_recording_start()), date(2026, 11, 30)
        )

        assert week["signups"] == 0
        for name in ["day_1", "day_7", "day_30"]:
            assert week[name]["status"] == "no_signups"

    @pytest.mark.scenario("ADMIN-R8.15")
    def test_current_week_without_signups(self) -> None:
        weeks = get_retention(date(2026, 12, 8), get_recording_start())

        assert weeks[0]["week_start"] == "2026-12-07"
        assert weeks[0]["signups"] == 0
        for name in ["day_1", "day_7", "day_30"]:
            assert weeks[0][name]["status"] == "no_signups"


@pytest.mark.django_db
class TestRetentionWeeks:
    @pytest.mark.scenario("ADMIN-R8.12")
    def test_weeks_before_recording_start_are_left_out(self) -> None:
        _record(_create_user("first"), date(2026, 10, 28))

        weeks = get_retention(date(2026, 12, 10), get_recording_start())

        assert weeks[-1]["week_start"] == "2026-11-02"

    @pytest.mark.scenario("ADMIN-R8.13")
    def test_recording_starts_on_monday(self) -> None:
        _record(_create_user("first"), date(2026, 11, 2))
        _create_users("u", 5, date(2026, 11, 2))

        weeks = get_retention(date(2026, 12, 10), get_recording_start())

        assert weeks[-1]["week_start"] == "2026-11-02"
        assert weeks[-1]["signups"] == 5

    @pytest.mark.scenario("ADMIN-R8.16")
    def test_no_week_to_list(self) -> None:
        _record(_create_user("first"), date(2026, 12, 9))

        assert get_retention(date(2026, 12, 10), get_recording_start()) == []
