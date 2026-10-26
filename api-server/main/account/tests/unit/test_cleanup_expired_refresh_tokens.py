from datetime import timedelta

import pytest
from django.utils import timezone

from main.account import OAuthOrganization
from main.account.models import RefreshToken, User
from main.account.services.tokens import delete_expired_refresh_tokens, issue_token_pair


@pytest.mark.django_db
class TestDeleteExpiredRefreshTokens:
    @pytest.fixture
    def user(self) -> User:
        return User.objects.create_user(
            oauth_org=OAuthOrganization.GOOGLE,
            oauth_id="test_oauth_id",
            email="test@example.com",
            username="Test User",
        )

    def test_deletes_expired_tokens(self, user: User) -> None:
        issue_token_pair(user)
        RefreshToken.objects.update(expires_at=timezone.now() - timedelta(seconds=1))

        deleted_count = delete_expired_refresh_tokens()

        assert deleted_count == 1
        assert not RefreshToken.objects.exists()

    def test_keeps_active_tokens(self, user: User) -> None:
        issue_token_pair(user)

        deleted_count = delete_expired_refresh_tokens()

        assert deleted_count == 0
        assert RefreshToken.objects.exists()
