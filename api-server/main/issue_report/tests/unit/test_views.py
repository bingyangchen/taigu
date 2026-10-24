import json

import pytest
from django.http import HttpRequest
from django.test import RequestFactory

from main.account.models import User
from main.issue_report.models import IssueReport
from main.issue_report.views import create_issue_report

DESKTOP_CHROME_USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36"
)
IPHONE_SAFARI_USER_AGENT = (
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 "
    "(KHTML, like Gecko) Version/18.6 Mobile/15E148 Safari/604.1"
)


@pytest.mark.django_db
class TestIssueReportViews:
    @pytest.fixture
    def user(self) -> User:
        return User.objects.create(
            oauth_org="google",
            oauth_id="issue_report_user",
            email="issue@example.com",
            username="issueuser",
        )

    @pytest.fixture
    def request_obj(self, user: User) -> HttpRequest:
        request = RequestFactory().post("/")
        request.user = user  # type: ignore
        return request

    @pytest.mark.scenario("ISSUE-R3.1")
    def test_create_issue_report(self, request_obj: HttpRequest, user: User) -> None:
        request_obj.META["HTTP_USER_AGENT"] = DESKTOP_CHROME_USER_AGENT
        request_obj._body = json.dumps(
            {"body": "點擊 Google 登入後畫面一直轉圈。", "platform": "web"}
        ).encode()

        response = create_issue_report(request_obj)
        data = json.loads(response.content)

        assert response.status_code == 200
        assert data["body"] == "點擊 Google 登入後畫面一直轉圈。"
        report = IssueReport.objects.get(pk=data["id"])
        assert report.user_id == user.pk
        assert report.created_at is not None
        assert report.platform == "web"
        assert report.user_agent == DESKTOP_CHROME_USER_AGENT

    @pytest.mark.scenario("ISSUE-R3.3")
    def test_create_issue_report_from_pwa(self, request_obj: HttpRequest) -> None:
        request_obj.META["HTTP_USER_AGENT"] = IPHONE_SAFARI_USER_AGENT
        request_obj._body = json.dumps(
            {"body": "匯出的檔案打不開。", "platform": "pwa"}
        ).encode()

        response = create_issue_report(request_obj)
        data = json.loads(response.content)

        assert response.status_code == 200
        report = IssueReport.objects.get(pk=data["id"])
        assert report.body == "匯出的檔案打不開。"
        assert report.platform == "pwa"
        assert report.user_agent == IPHONE_SAFARI_USER_AGENT

    @pytest.mark.parametrize(
        "payload",
        [
            pytest.param({"body": "畫面一直轉圈"}, id="old frontend"),
            pytest.param({"body": "畫面一直轉圈", "platform": "ios"}, id="unknown"),
            pytest.param(
                {"body": "畫面一直轉圈", "platform": ["web"]}, id="non-string"
            ),
        ],
    )
    def test_create_issue_report_without_known_platform(
        self, request_obj: HttpRequest, payload: dict
    ) -> None:
        """What the user wrote matters more than the platform."""
        request_obj._body = json.dumps(payload).encode()

        response = create_issue_report(request_obj)
        data = json.loads(response.content)

        assert response.status_code == 200
        report = IssueReport.objects.get(pk=data["id"])
        assert report.body == "畫面一直轉圈"
        assert report.platform is None

    def test_create_issue_report_without_user_agent(
        self, request_obj: HttpRequest
    ) -> None:
        request_obj._body = json.dumps(
            {"body": "畫面一直轉圈", "platform": "web"}
        ).encode()

        response = create_issue_report(request_obj)
        data = json.loads(response.content)

        assert response.status_code == 200
        assert IssueReport.objects.get(pk=data["id"]).user_agent is None

    @pytest.mark.scenario("ISSUE-R2.1")
    def test_create_issue_report_rejects_blank_body(
        self, request_obj: HttpRequest
    ) -> None:
        request_obj._body = json.dumps({"body": "  "}).encode()

        response = create_issue_report(request_obj)

        assert response.status_code == 400
        assert IssueReport.objects.count() == 0

    def test_create_issue_report_rejects_non_string_body(
        self, request_obj: HttpRequest
    ) -> None:
        request_obj._body = json.dumps({"body": 123}).encode()

        response = create_issue_report(request_obj)

        assert response.status_code == 400
