from datetime import date

import pytest
from django.db import IntegrityError

from main.account import OAuthOrganization
from main.account.models import User
from main.usage.models import DailyActivity, Platform


@pytest.mark.django_db
class TestDailyActivity:
    @pytest.fixture
    def user(self) -> User:
        return User.objects.create_user(
            oauth_org=OAuthOrganization.GOOGLE,
            oauth_id="usage_user",
            email="usage@example.com",
            username="Usage User",
        )

    @pytest.mark.scenario("USAGE-R2.1")
    def test_deleting_user_deletes_daily_activities(self, user: User) -> None:
        DailyActivity.objects.create(
            user=user, date=date(2026, 10, 24), platform=Platform.WEB
        )
        DailyActivity.objects.create(
            user=user, date=date(2026, 10, 25), platform=Platform.PWA
        )

        user.delete()

        assert not DailyActivity.objects.exists()

    def test_rejects_second_row_without_platform_on_same_day(self, user: User) -> None:
        """
        Two tabs of an old frontend that open at the same moment race past the
        lookup before insert, so only the database can keep the row unique.
        """
        DailyActivity.objects.create(user=user, date=date(2026, 10, 24), platform=None)

        with pytest.raises(IntegrityError):
            DailyActivity.objects.create(
                user=user, date=date(2026, 10, 24), platform=None
            )
