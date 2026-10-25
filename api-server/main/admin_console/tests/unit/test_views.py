import json
from datetime import datetime, timedelta

import pytest
from django.conf import settings
from django.db import connection
from django.test import Client
from django.test.client import RequestFactory
from django.test.utils import CaptureQueriesContext
from django.utils import timezone
from jose import jwt

from main.account import ACCESS_COOKIE_NAME, REFRESH_COOKIE_NAME, OAuthOrganization
from main.account.models import User
from main.account.tokens import issue_token_pair
from main.issue_report.models import IssueReport
from main.issue_report.views import create_issue_report
from main.usage.models import DailyActivity, Platform


def _create_user(name: str, *, is_superuser: bool = False) -> User:
    return User.objects.create_user(
        oauth_org=OAuthOrganization.GOOGLE,
        oauth_id=name,
        email=f"{name}@example.com",
        username=name,
        is_superuser=is_superuser,
    )


def _make_browser(user: User) -> Client:
    browser = Client()
    browser.cookies[ACCESS_COOKIE_NAME] = issue_token_pair(user).access_token
    return browser


def _create_reports(user: User, count: int, *, handled: bool = False) -> list[int]:
    """
    Each call creates reports newer than the existing ones, and returns their ids
    from newest to oldest.
    """
    base = timezone.now() - timedelta(days=1)
    existing_count = IssueReport.objects.count()
    ids = []
    for i in range(count):
        report = IssueReport.objects.create(user=user, body=f"回報 {i}")
        IssueReport.objects.filter(pk=report.pk).update(
            created_at=base + timedelta(minutes=existing_count + i),
            handled_at=timezone.now() if handled else None,
        )
        ids.append(report.pk)
    return ids[::-1]


@pytest.mark.django_db
class TestPermission:
    @pytest.mark.scenario("ADMIN-R1.3")
    def test_non_superuser_gets_same_response_as_unknown_url(self) -> None:
        user = _create_user("user")
        _create_reports(user, 1)
        browser = _make_browser(user)

        admin_response = browser.get("/api/admin/issue-reports")
        unknown_response = browser.get("/api/does-not-exist")
        me_response = browser.get("/api/account/me")

        assert admin_response.status_code == 404
        assert admin_response.status_code == unknown_response.status_code
        assert admin_response.content == unknown_response.content
        assert ACCESS_COOKIE_NAME not in admin_response.cookies
        assert me_response.status_code == 200
        me_data = json.loads(me_response.content)
        assert me_data["username"] == "user"
        assert me_data["email"] == "user@example.com"

    def test_non_superuser_cannot_mark_issue_report(self) -> None:
        user = _create_user("user")
        (report_id,) = _create_reports(user, 1)

        response = _make_browser(user).post(
            f"/api/admin/issue-reports/{report_id}/handled", {"is_handled": "true"}
        )

        assert response.status_code == 404
        assert IssueReport.objects.get(pk=report_id).handled_at is None

    def test_non_superuser_post_without_csrf_token_gets_404(self) -> None:
        """
        Django checks CSRF before the view runs, which would answer a non-superuser
        with 403 and reveal that the endpoint exists (ADMIN-R1).
        """
        user = _create_user("user")
        (report_id,) = _create_reports(user, 1)
        browser = Client(enforce_csrf_checks=True)
        browser.cookies[ACCESS_COOKIE_NAME] = issue_token_pair(user).access_token

        admin_response = browser.post(
            f"/api/admin/issue-reports/{report_id}/handled", {"is_handled": "true"}
        )
        unknown_response = browser.post("/api/does-not-exist", {"is_handled": "true"})

        assert admin_response.status_code == 404
        assert admin_response.content == unknown_response.content

    def test_superuser_post_without_csrf_token_is_rejected(self) -> None:
        superuser = _create_user("dev", is_superuser=True)
        (report_id,) = _create_reports(superuser, 1)
        browser = Client(enforce_csrf_checks=True)
        browser.cookies[ACCESS_COOKIE_NAME] = issue_token_pair(superuser).access_token

        response = browser.post(
            f"/api/admin/issue-reports/{report_id}/handled", {"is_handled": "true"}
        )

        assert response.status_code == 403
        assert IssueReport.objects.get(pk=report_id).handled_at is None

    def test_anonymous_request_gets_401(self) -> None:
        response = Client().get("/api/admin/usage")

        assert response.status_code == 401

    @pytest.mark.scenario("ADMIN-R1.6")
    def test_mark_after_access_token_expired(self) -> None:
        superuser = _create_user("dev", is_superuser=True)
        (report_id,) = _create_reports(superuser, 1)
        browser = Client()
        browser.cookies[REFRESH_COOKIE_NAME] = issue_token_pair(superuser).refresh_token
        browser.cookies[ACCESS_COOKIE_NAME] = jwt.encode(
            {"id": str(superuser.id), "exp": int(datetime.now().timestamp()) - 60},
            settings.SECRET_KEY,
            algorithm=settings.JWT_ALGORITHM,
        )
        url = f"/api/admin/issue-reports/{report_id}/handled"

        expired_response = browser.post(url, {"is_handled": "true"})
        browser.post("/api/account/refresh-token")
        retried_response = browser.post(url, {"is_handled": "true"})
        listed = browser.get("/api/admin/issue-reports")

        assert expired_response.status_code == 401
        assert retried_response.status_code == 200
        assert json.loads(retried_response.content)["report"]["is_handled"] is True
        assert json.loads(listed.content)["reports"] == []


@pytest.mark.django_db
class TestIssueReportViews:
    @pytest.fixture
    def superuser(self) -> User:
        return _create_user("dev", is_superuser=True)

    @pytest.fixture
    def reporter(self) -> User:
        return _create_user("reporter")

    @pytest.fixture
    def browser(self, superuser: User) -> Client:
        return _make_browser(superuser)

    def _list(
        self, browser: Client, report_filter: str = "unhandled", cursor: str = ""
    ) -> dict:
        params = {"filter": report_filter}
        if cursor:
            params["cursor"] = cursor
        response = browser.get("/api/admin/issue-reports", params)
        assert response.status_code == 200
        return json.loads(response.content)

    def _mark(self, browser: Client, report_id: int, *, is_handled: bool) -> dict:
        response = browser.post(
            f"/api/admin/issue-reports/{report_id}/handled",
            {"is_handled": "true" if is_handled else "false"},
        )
        assert response.status_code == 200
        return json.loads(response.content)

    def _count_unhandled(self, browser: Client) -> int:
        response = browser.get("/api/admin/issue-reports/unhandled-count")
        return json.loads(response.content)["count"]

    @pytest.mark.scenario("ADMIN-R4.1")
    def test_unhandled_count(self, browser: Client, reporter: User) -> None:
        _create_reports(reporter, 3)
        _create_reports(reporter, 2, handled=True)

        assert self._count_unhandled(browser) == 3

    @pytest.mark.scenario("ADMIN-R12.1")
    def test_lists_unhandled_reports_by_default(
        self, browser: Client, reporter: User
    ) -> None:
        _create_reports(reporter, 2, handled=True)
        unhandled_ids = _create_reports(reporter, 3)

        data = self._list(browser)

        assert [report["id"] for report in data["reports"]] == unhandled_ids
        assert data["next_cursor"] is None
        assert data["reports"][0]["email"] == "reporter@example.com"

    @pytest.mark.scenario("ADMIN-R12.2")
    def test_lists_all_reports(self, browser: Client, reporter: User) -> None:
        handled_ids = _create_reports(reporter, 2, handled=True)
        unhandled_ids = _create_reports(reporter, 3)

        reports = self._list(browser, "all")["reports"]

        assert [report["id"] for report in reports] == unhandled_ids + handled_ids
        assert [report["is_handled"] for report in reports] == [
            False,
            False,
            False,
            True,
            True,
        ]

    @pytest.mark.scenario("ADMIN-R12.3")
    def test_load_more(self, browser: Client, reporter: User) -> None:
        ids = _create_reports(reporter, 15)

        first_page = self._list(browser)
        second_page = self._list(browser, cursor=first_page["next_cursor"])

        assert [report["id"] for report in first_page["reports"]] == ids[:10]
        assert first_page["next_cursor"] is not None
        assert [report["id"] for report in second_page["reports"]] == ids[10:]
        assert second_page["next_cursor"] is None

    @pytest.mark.scenario("ADMIN-R12.4")
    def test_exactly_one_page(self, browser: Client, reporter: User) -> None:
        _create_reports(reporter, 10)

        data = self._list(browser)

        assert len(data["reports"]) == 10
        assert data["next_cursor"] is None

    @pytest.mark.scenario("ADMIN-R12.5")
    def test_load_more_after_marking(self, browser: Client, reporter: User) -> None:
        ids = _create_reports(reporter, 15)
        first_page = self._list(browser)

        self._mark(browser, ids[0], is_handled=True)
        second_page = self._list(browser, cursor=first_page["next_cursor"])

        shown_ids = [report["id"] for report in first_page["reports"][1:]] + [
            report["id"] for report in second_page["reports"]
        ]
        assert shown_ids == ids[1:]

    def test_reports_with_same_time_are_paged_once(
        self, browser: Client, reporter: User
    ) -> None:
        ids = _create_reports(reporter, 15)
        IssueReport.objects.update(created_at=timezone.now())

        first_page = self._list(browser)
        second_page = self._list(browser, cursor=first_page["next_cursor"])

        shown_ids = [report["id"] for report in first_page["reports"]] + [
            report["id"] for report in second_page["reports"]
        ]
        assert sorted(shown_ids) == sorted(ids)

    def test_rejects_cursor_id_beyond_bigint(self, browser: Client) -> None:
        response = browser.get(
            "/api/admin/issue-reports", {"cursor": f"2026-10-24T00:00:00+00:00_{2**63}"}
        )

        assert response.status_code == 400

    def test_report_id_beyond_bigint_is_not_found(self, browser: Client) -> None:
        response = browser.post(
            f"/api/admin/issue-reports/{2**63}/handled", {"is_handled": "true"}
        )

        assert response.status_code == 404

    def test_rejects_malformed_cursor(self, browser: Client) -> None:
        response = browser.get("/api/admin/issue-reports", {"cursor": "abc"})

        assert response.status_code == 400

    @pytest.mark.scenario("ADMIN-R12.13")
    def test_empty_user_agent_is_unrecorded(
        self, browser: Client, reporter: User
    ) -> None:
        request = RequestFactory().post("/", HTTP_USER_AGENT="")
        request.user = reporter  # type: ignore
        request._body = json.dumps({"body": "匯出的檔案打不開。"}).encode()
        create_issue_report(request)

        (report,) = self._list(browser)["reports"]

        assert report["user_agent"] is None

    @pytest.mark.scenario("ADMIN-R13.1")
    def test_mark_handled(self, browser: Client, reporter: User) -> None:
        ids = _create_reports(reporter, 3)

        data = self._mark(browser, ids[0], is_handled=True)

        assert data["report"]["is_handled"] is True
        assert data["unhandled_count"] == 2
        assert [report["id"] for report in self._list(browser)["reports"]] == ids[1:]

    @pytest.mark.scenario("ADMIN-R13.2")
    def test_mark_unhandled(self, browser: Client, reporter: User) -> None:
        (handled_id,) = _create_reports(reporter, 1, handled=True)
        _create_reports(reporter, 2)

        data = self._mark(browser, handled_id, is_handled=False)

        assert data["report"]["is_handled"] is False
        assert data["unhandled_count"] == 3

    @pytest.mark.scenario("ADMIN-R13.3")
    def test_new_report_is_unhandled(self, browser: Client, reporter: User) -> None:
        _create_reports(reporter, 2, handled=True)
        request = RequestFactory().post("/")
        request.user = reporter  # type: ignore
        request._body = json.dumps({"body": "匯出的檔案打不開。"}).encode()
        new_id = json.loads(create_issue_report(request).content)["id"]

        reports = self._list(browser)["reports"]

        assert [report["id"] for report in reports] == [new_id]
        assert self._count_unhandled(browser) == 1

    @pytest.mark.scenario("ADMIN-R13.7")
    def test_mark_last_unhandled(self, browser: Client, reporter: User) -> None:
        (report_id,) = _create_reports(reporter, 1)

        data = self._mark(browser, report_id, is_handled=True)

        assert data["unhandled_count"] == 0
        assert self._list(browser)["reports"] == []

    def test_marking_twice_keeps_first_handled_time(
        self, browser: Client, reporter: User
    ) -> None:
        (report_id,) = _create_reports(reporter, 1)
        self._mark(browser, report_id, is_handled=True)
        handled_at = IssueReport.objects.get(pk=report_id).handled_at

        self._mark(browser, report_id, is_handled=True)

        assert IssueReport.objects.get(pk=report_id).handled_at == handled_at


@pytest.mark.django_db
class TestStatisticsViews:
    @pytest.fixture
    def browser(self) -> Client:
        return _make_browser(_create_user("dev", is_superuser=True))

    def test_usage(self, browser: Client) -> None:
        response = browser.get("/api/admin/usage")

        data = json.loads(response.content)
        assert response.status_code == 200
        assert data["summary"]["registered"] == {"value": 0, "change": 0}
        assert data["days"] == []
        assert data["retention"] == []

    @pytest.mark.parametrize(
        "path",
        ["/api/admin/usage", "/api/admin/usage/daily", "/api/admin/subscriptions"],
    )
    def test_query_count_does_not_grow_with_data(
        self, browser: Client, path: str
    ) -> None:
        """
        The statistics are aggregated per request; a query per user, week, or day
        would make the console slower as Taigu grows.
        """
        today = timezone.localdate()

        def count_queries() -> int:
            with CaptureQueriesContext(connection) as context:
                assert browser.get(path).status_code == 200
            return len(context.captured_queries)

        def add_users(prefix: str, count: int) -> None:
            for i in range(count):
                user = _create_user(f"{prefix}{i}")
                for days_ago in range(0, 120, 3):
                    DailyActivity.objects.create(
                        user=user,
                        date=today - timedelta(days=days_ago + i),
                        platform=Platform.WEB,
                    )

        add_users("small", 2)
        small_count = count_queries()
        add_users("large", 30)

        assert count_queries() == small_count

    def test_subscriptions(self, browser: Client) -> None:
        response = browser.get("/api/admin/subscriptions")

        data = json.loads(response.content)
        assert response.status_code == 200
        assert data["statuses"]["unsubscribed"] == 1
        assert data["whitelisted"] == 0
        assert data["trial_conversions"] == []
        assert data["monthly_payments"] == []
