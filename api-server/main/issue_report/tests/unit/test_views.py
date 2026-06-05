import json

import pytest
from django.http import HttpRequest
from django.test import RequestFactory

from main.account.models import User
from main.issue_report.models import IssueReport
from main.issue_report.views import create_issue_report


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

    def test_create_issue_report(self, request_obj: HttpRequest, user: User) -> None:
        request_obj._body = json.dumps(
            {"body": "點擊 Google 登入後畫面一直轉圈。"}
        ).encode()

        response = create_issue_report(request_obj)
        data = json.loads(response.content)

        assert response.status_code == 200
        assert data["body"] == "點擊 Google 登入後畫面一直轉圈。"
        report = IssueReport.objects.get(pk=data["id"])
        assert report.user_id == user.pk
        assert report.created_at is not None

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
