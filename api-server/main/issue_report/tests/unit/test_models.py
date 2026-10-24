import pytest

from main.account import OAuthOrganization
from main.account.models import User
from main.issue_report.models import IssueReport


@pytest.mark.django_db
@pytest.mark.scenario("ISSUE-R7.1")
def test_deleting_user_deletes_issue_reports() -> None:
    user = User.objects.create_user(
        oauth_org=OAuthOrganization.GOOGLE,
        oauth_id="issue_report_owner",
        email="owner@example.com",
        username="Owner",
    )
    IssueReport.objects.create(user=user, body="畫面一直轉圈")

    user.delete()

    assert not IssueReport.objects.exists()
