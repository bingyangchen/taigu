import pytest

from main.account import OAuthOrganization
from main.account.models import RefreshToken, User
from main.account.tokens import (
    InvalidRefreshTokenError,
    issue_token_pair,
    rotate_refresh_token,
)


@pytest.mark.django_db
class TestRefreshTokenRotation:
    @pytest.fixture
    def user(self) -> User:
        return User.objects.create_user(
            oauth_org=OAuthOrganization.GOOGLE,
            oauth_id="test_oauth_id",
            email="test@example.com",
            username="Test User",
        )

    def test_rotate_refresh_token_replaces_current_token(self, user: User) -> None:
        token_pair = issue_token_pair(user)

        replacement = rotate_refresh_token(token_pair.refresh_token)

        assert replacement is not None
        current_token = RefreshToken.objects.get(revoked_at__isnull=False)
        replacement_token = RefreshToken.objects.get(revoked_at__isnull=True)
        assert current_token.revoked_at is not None
        assert current_token.family_id == replacement_token.family_id

    @pytest.mark.scenario("ACCT-R6.1")
    def test_reusing_rotated_token_revokes_family(self, user: User) -> None:
        token_pair = issue_token_pair(user)
        replacement = rotate_refresh_token(token_pair.refresh_token)

        with pytest.raises(InvalidRefreshTokenError):
            rotate_refresh_token(token_pair.refresh_token)

        assert replacement is not None
        assert not RefreshToken.objects.filter(
            family_id=RefreshToken.objects.first().family_id, revoked_at__isnull=True
        ).exists()

    def test_rotate_missing_refresh_token_raises(self) -> None:
        with pytest.raises(InvalidRefreshTokenError):
            rotate_refresh_token("")
