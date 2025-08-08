from datetime import datetime, timedelta

import pytest
from django.conf import settings
from django.contrib.auth import authenticate
from django.http import HttpRequest
from jose import jwt
from jose.constants import ALGORITHMS

from main.account import OAuthOrganization
from main.account.backends import MyBackend
from main.account.models import User


@pytest.mark.django_db
class TestMyBackend:
    @pytest.fixture
    def backend(self) -> MyBackend:
        """Create a MyBackend instance for testing."""
        return MyBackend()

    @pytest.fixture
    def request_obj(self) -> HttpRequest:
        """Create a sample request object."""
        return HttpRequest()

    @pytest.fixture
    def user(self) -> User:
        """Create a sample user for testing."""
        return User.objects.create_user(
            oauth_org=OAuthOrganization.GOOGLE,
            oauth_id="test_oauth_id",
            email="test@example.com",
            username="Test User",
        )

    def test_authenticate_valid_token_success(
        self, backend: MyBackend, request_obj: HttpRequest, user: User
    ) -> None:
        """Test successful authentication with valid token."""
        # Create a valid JWT token
        payload = {
            "id": str(user.id),
            "oauth_id": user.oauth_id,
            "iat": int(datetime.now().timestamp()),
            "exp": int((datetime.now() + timedelta(days=30)).timestamp()),
        }
        token = jwt.encode(payload, settings.SECRET_KEY, algorithm=ALGORITHMS.HS256)

        authenticated_user = backend.authenticate(request_obj, token)

        assert authenticated_user == user
        assert request_obj.user == user

    def test_authenticate_expired_token(
        self, backend: MyBackend, request_obj: HttpRequest, user: User
    ) -> None:
        """Test authentication with expired token."""
        # Create an expired JWT token
        payload = {
            "id": str(user.id),
            "oauth_id": user.oauth_id,
            "iat": int((datetime.now() - timedelta(days=2)).timestamp()),
            "exp": int((datetime.now() - timedelta(days=1)).timestamp()),
        }
        token = jwt.encode(payload, settings.SECRET_KEY, algorithm=ALGORITHMS.HS256)

        authenticated_user = backend.authenticate(request_obj, token)

        assert authenticated_user is None
        assert request_obj.user is None

    def test_authenticate_invalid_token_format(
        self, backend: MyBackend, request_obj: HttpRequest
    ) -> None:
        """Test authentication with invalid token format."""
        token = "invalid_token_format"  # noqa: S105

        authenticated_user = backend.authenticate(request_obj, token)

        assert authenticated_user is None
        assert request_obj.user is None

    def test_authenticate_malformed_token(
        self, backend: MyBackend, request_obj: HttpRequest
    ) -> None:
        """Test authentication with malformed token."""
        token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid.signature"  # noqa: S105

        authenticated_user = backend.authenticate(request_obj, token)

        assert authenticated_user is None
        assert request_obj.user is None

    def test_authenticate_wrong_secret_key(
        self, backend: MyBackend, request_obj: HttpRequest, user: User
    ) -> None:
        """Test authentication with token signed with wrong secret key."""
        payload = {
            "id": str(user.id),
            "oauth_id": user.oauth_id,
            "iat": int(datetime.now().timestamp()),
            "exp": int((datetime.now() + timedelta(days=30)).timestamp()),
        }
        token = jwt.encode(payload, "wrong_secret_key", algorithm=ALGORITHMS.HS256)

        authenticated_user = backend.authenticate(request_obj, token)

        assert authenticated_user is None
        assert request_obj.user is None

    def test_authenticate_missing_user_id(
        self, backend: MyBackend, request_obj: HttpRequest, user: User
    ) -> None:
        """Test authentication with token missing user ID."""
        payload = {
            "oauth_id": user.oauth_id,
            "iat": int(datetime.now().timestamp()),
            "exp": int((datetime.now() + timedelta(days=30)).timestamp()),
        }
        token = jwt.encode(payload, settings.SECRET_KEY, algorithm=ALGORITHMS.HS256)

        authenticated_user = backend.authenticate(request_obj, token)

        assert authenticated_user is None
        assert request_obj.user is None

    def test_authenticate_missing_oauth_id(
        self, backend: MyBackend, request_obj: HttpRequest, user: User
    ) -> None:
        """Test authentication with token missing oauth_id."""
        payload = {
            "id": str(user.id),
            "iat": int(datetime.now().timestamp()),
            "exp": int((datetime.now() + timedelta(days=30)).timestamp()),
        }
        token = jwt.encode(payload, settings.SECRET_KEY, algorithm=ALGORITHMS.HS256)

        authenticated_user = backend.authenticate(request_obj, token)

        assert authenticated_user is None
        assert request_obj.user is None

    def test_authenticate_missing_exp(
        self, backend: MyBackend, request_obj: HttpRequest, user: User
    ) -> None:
        """Test authentication with token missing expiration."""
        payload = {
            "id": str(user.id),
            "oauth_id": user.oauth_id,
            "iat": int(datetime.now().timestamp()),
        }
        token = jwt.encode(payload, settings.SECRET_KEY, algorithm=ALGORITHMS.HS256)

        authenticated_user = backend.authenticate(request_obj, token)

        assert authenticated_user is None
        assert request_obj.user is None

    def test_authenticate_nonexistent_user(
        self, backend: MyBackend, request_obj: HttpRequest
    ) -> None:
        """Test authentication with token for non-existent user."""
        payload = {
            "id": "00000000-0000-0000-0000-000000000000",
            "oauth_id": "nonexistent_oauth_id",
            "iat": int(datetime.now().timestamp()),
            "exp": int((datetime.now() + timedelta(days=30)).timestamp()),
        }
        token = jwt.encode(payload, settings.SECRET_KEY, algorithm=ALGORITHMS.HS256)

        authenticated_user = backend.authenticate(request_obj, token)

        assert authenticated_user is None
        assert request_obj.user is None

    def test_authenticate_oauth_id_mismatch(
        self, backend: MyBackend, request_obj: HttpRequest, user: User
    ) -> None:
        """Test authentication with token where oauth_id doesn't match user."""
        payload = {
            "id": str(user.id),
            "oauth_id": "different_oauth_id",
            "iat": int(datetime.now().timestamp()),
            "exp": int((datetime.now() + timedelta(days=30)).timestamp()),
        }
        token = jwt.encode(payload, settings.SECRET_KEY, algorithm=ALGORITHMS.HS256)

        authenticated_user = backend.authenticate(request_obj, token)

        assert authenticated_user is None
        assert request_obj.user is None

    def test_authenticate_none_token(
        self, backend: MyBackend, request_obj: HttpRequest
    ) -> None:
        """Test authentication with None token."""
        authenticated_user = backend.authenticate(request_obj, None)

        assert authenticated_user is None
        assert request_obj.user is None

    def test_authenticate_empty_token(
        self, backend: MyBackend, request_obj: HttpRequest
    ) -> None:
        """Test authentication with empty token."""
        authenticated_user = backend.authenticate(request_obj, "")

        assert authenticated_user is None
        assert request_obj.user is None

    def test_authenticate_with_django_authenticate(
        self, backend: MyBackend, request_obj: HttpRequest, user: User
    ) -> None:
        """Test authentication using Django's authenticate function."""
        payload = {
            "id": str(user.id),
            "oauth_id": user.oauth_id,
            "iat": int(datetime.now().timestamp()),
            "exp": int((datetime.now() + timedelta(days=30)).timestamp()),
        }
        token = jwt.encode(payload, settings.SECRET_KEY, algorithm=ALGORITHMS.HS256)

        authenticated_user = authenticate(request_obj, token=token)

        assert authenticated_user == user
        assert request_obj.user == user

    def test_authenticate_token_with_extra_fields(
        self, backend: MyBackend, request_obj: HttpRequest, user: User
    ) -> None:
        """Test authentication with token containing extra fields."""
        payload = {
            "id": str(user.id),
            "oauth_id": user.oauth_id,
            "iat": int(datetime.now().timestamp()),
            "exp": int((datetime.now() + timedelta(days=30)).timestamp()),
            "extra_field": "extra_value",
        }
        token = jwt.encode(payload, settings.SECRET_KEY, algorithm=ALGORITHMS.HS256)

        authenticated_user = backend.authenticate(request_obj, token)

        assert authenticated_user == user
        assert request_obj.user == user

    def test_authenticate_token_without_iat(
        self, backend: MyBackend, request_obj: HttpRequest, user: User
    ) -> None:
        """Test authentication with token without issued_at field."""
        payload = {
            "id": str(user.id),
            "oauth_id": user.oauth_id,
            "exp": int((datetime.now() + timedelta(days=30)).timestamp()),
        }
        token = jwt.encode(payload, settings.SECRET_KEY, algorithm=ALGORITHMS.HS256)

        authenticated_user = backend.authenticate(request_obj, token)

        assert authenticated_user == user
        assert request_obj.user == user

    def test_authenticate_token_expiring_soon(
        self, backend: MyBackend, request_obj: HttpRequest, user: User
    ) -> None:
        """Test authentication with token expiring soon."""
        payload = {
            "id": str(user.id),
            "oauth_id": user.oauth_id,
            "iat": int(datetime.now().timestamp()),
            "exp": int((datetime.now() + timedelta(seconds=1)).timestamp()),
        }
        token = jwt.encode(payload, settings.SECRET_KEY, algorithm=ALGORITHMS.HS256)

        authenticated_user = backend.authenticate(request_obj, token)

        assert authenticated_user == user
        assert request_obj.user == user

    def test_authenticate_token_expired_by_seconds(
        self, backend: MyBackend, request_obj: HttpRequest, user: User
    ) -> None:
        """Test authentication with token expired by seconds."""
        payload = {
            "id": str(user.id),
            "oauth_id": user.oauth_id,
            "iat": int((datetime.now() - timedelta(minutes=1)).timestamp()),
            "exp": int((datetime.now() - timedelta(seconds=1)).timestamp()),
        }
        token = jwt.encode(payload, settings.SECRET_KEY, algorithm=ALGORITHMS.HS256)

        authenticated_user = backend.authenticate(request_obj, token)

        assert authenticated_user is None
        assert request_obj.user is None

    def test_authenticate_multiple_users_same_oauth_id(
        self, backend: MyBackend, request_obj: HttpRequest, user: User
    ) -> None:
        """Test authentication when multiple users have same oauth_id but different orgs."""
        # Create another user with same oauth_id but different org
        User.objects.create_user(
            oauth_org=OAuthOrganization.FACEGOOK,
            oauth_id=user.oauth_id,  # Same oauth_id
            email="test2@example.com",
            username="Test User 2",
        )

        # Token for first user
        payload = {
            "id": str(user.id),
            "oauth_id": user.oauth_id,
            "iat": int(datetime.now().timestamp()),
            "exp": int((datetime.now() + timedelta(days=30)).timestamp()),
        }
        token = jwt.encode(payload, settings.SECRET_KEY, algorithm=ALGORITHMS.HS256)

        authenticated_user = backend.authenticate(request_obj, token)

        assert authenticated_user == user
        assert request_obj.user == user

    def test_authenticate_user_deactivated(
        self, backend: MyBackend, request_obj: HttpRequest, user: User
    ) -> None:
        """Test authentication with deactivated user."""
        user.is_active = False
        user.save()

        payload = {
            "id": str(user.id),
            "oauth_id": user.oauth_id,
            "iat": int(datetime.now().timestamp()),
            "exp": int((datetime.now() + timedelta(days=30)).timestamp()),
        }
        token = jwt.encode(payload, settings.SECRET_KEY, algorithm=ALGORITHMS.HS256)

        authenticated_user = backend.authenticate(request_obj, token)

        # Should still authenticate even if user is deactivated
        # (this is the current behavior, but could be changed if needed)
        assert authenticated_user == user
        assert request_obj.user == user

    def test_authenticate_invalid_uuid_format(
        self, backend: MyBackend, request_obj: HttpRequest, user: User
    ) -> None:
        """Test authentication with invalid UUID format in token."""
        payload = {
            "id": "invalid-uuid-format",
            "oauth_id": user.oauth_id,
            "iat": int(datetime.now().timestamp()),
            "exp": int((datetime.now() + timedelta(days=30)).timestamp()),
        }
        token = jwt.encode(payload, settings.SECRET_KEY, algorithm=ALGORITHMS.HS256)

        authenticated_user = backend.authenticate(request_obj, token)

        assert authenticated_user is None
        assert request_obj.user is None

    def test_authenticate_token_with_future_iat(
        self, backend: MyBackend, request_obj: HttpRequest, user: User
    ) -> None:
        """Test authentication with token having future issued_at time."""
        payload = {
            "id": str(user.id),
            "oauth_id": user.oauth_id,
            "iat": int((datetime.now() + timedelta(days=1)).timestamp()),
            "exp": int((datetime.now() + timedelta(days=30)).timestamp()),
        }
        token = jwt.encode(payload, settings.SECRET_KEY, algorithm=ALGORITHMS.HS256)

        authenticated_user = backend.authenticate(request_obj, token)

        # Should still work as we don't validate iat
        assert authenticated_user == user
        assert request_obj.user == user
