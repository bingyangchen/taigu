# ruff: noqa: ANN401

"""
Test configuration and shared fixtures for account module tests.
"""

from datetime import datetime, timedelta
from typing import Any

import pytest
from django.conf import settings
from django.http import HttpRequest, HttpResponse
from jose import jwt
from jose.constants import ALGORITHMS

from main.account import OAuthOrganization
from main.account.models import User


@pytest.fixture
def sample_user() -> User:
    """Create a sample user with avatar for testing."""
    return User.objects.create_user(
        oauth_org=OAuthOrganization.GOOGLE,
        oauth_id="test_oauth_id",
        email="test@example.com",
        username="Test User",
        avatar_url="https://example.com/avatar.jpg",
    )


@pytest.fixture
def sample_user_no_avatar() -> User:
    """Create a sample user without avatar for testing."""
    return User.objects.create_user(
        oauth_org=OAuthOrganization.GOOGLE,
        oauth_id="test_oauth_id_no_avatar",
        email="test_no_avatar@example.com",
        username="Test User No Avatar",
    )


@pytest.fixture
def facebook_user() -> User:
    """Create a Facebook OAuth user for testing."""
    return User.objects.create_user(
        oauth_org=OAuthOrganization.FACEGOOK,
        oauth_id="facebook_oauth_id",
        email="facebook@example.com",
        username="Facebook User",
        avatar_url="https://example.com/facebook_avatar.jpg",
    )


@pytest.fixture
def valid_jwt_token(sample_user: User) -> str:
    """Create a valid JWT token for testing."""
    payload = {
        "id": str(sample_user.id),
        "oauth_id": sample_user.oauth_id,
        "iat": int(datetime.now().timestamp()),
        "exp": int((datetime.now() + timedelta(days=30)).timestamp()),
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=ALGORITHMS.HS256)


@pytest.fixture
def expired_jwt_token(sample_user: User) -> str:
    """Create an expired JWT token for testing."""
    payload = {
        "id": str(sample_user.id),
        "oauth_id": sample_user.oauth_id,
        "iat": int((datetime.now() - timedelta(days=2)).timestamp()),
        "exp": int((datetime.now() - timedelta(days=1)).timestamp()),
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=ALGORITHMS.HS256)


@pytest.fixture
def invalid_jwt_token() -> str:
    """Create an invalid JWT token for testing."""
    return "invalid_token_format"


@pytest.fixture
def mock_google_verify_result() -> dict[str, Any]:
    """Mock Google OAuth verification result."""
    return {
        "sub": "test_oauth_id",
        "email": "test@example.com",
        "name": "Test User",
        "picture": "https://example.com/avatar.jpg",
    }


@pytest.fixture
def mock_google_flow() -> Any:
    """Mock Google OAuth flow."""
    flow = pytest.Mock()
    flow.authorization_url.return_value = ("https://auth.url", "state123")
    return flow


@pytest.fixture
def google_oauth_scopes() -> list[str]:
    """Google OAuth scopes for testing."""
    return [
        "https://www.googleapis.com/auth/userinfo.profile",
        "https://www.googleapis.com/auth/userinfo.email",
    ]


@pytest.fixture
def sample_request() -> HttpRequest:
    """Create a sample HTTP request for testing."""
    request = HttpRequest()
    request.method = "GET"
    request.GET = {"redirect_uri": "https://example.com/callback"}
    return request


@pytest.fixture
def sample_post_request() -> HttpRequest:
    """Create a sample POST HTTP request for testing."""
    request = HttpRequest()
    request.method = "POST"
    request.POST = {
        "code": "auth_code",
        "redirect_uri": "https://example.com/callback",
    }
    return request


@pytest.fixture
def user_manager() -> Any:
    """Create a UserManager instance for testing."""
    from main.account.models import UserManager

    manager = UserManager()
    manager.model = User
    return manager


@pytest.fixture
def auth_backend() -> Any:
    """Create a MyBackend instance for testing."""
    from main.account.backends import MyBackend

    return MyBackend()


@pytest.fixture
def middleware_factory() -> Any:
    """Create a middleware factory for testing."""
    from main.account.middleware import check_login_status_middleware

    return check_login_status_middleware


@pytest.fixture
def sample_response() -> HttpResponse:
    """Create a sample HTTP response for testing."""
    return HttpResponse("Test response")


@pytest.fixture
def login_response() -> HttpResponse:
    """Create a sample login response for testing."""
    response = HttpResponse("Login response")
    response["is-log-in"] = "yes"
    return response


@pytest.fixture
def logout_response() -> HttpResponse:
    """Create a sample logout response for testing."""
    response = HttpResponse("Logout response")
    response["is-log-out"] = "yes"
    return response


@pytest.fixture
def unauthorized_response() -> HttpResponse:
    """Create a sample 401 response for testing."""
    return HttpResponse("Unauthorized", status=401)


@pytest.fixture
def update_user_data() -> dict[str, str]:
    """Sample user update data for testing."""
    return {
        "username": "New Username",
        "avatar_url": "https://example.com/new_avatar.jpg",
    }


@pytest.fixture
def cookie_settings() -> dict[str, Any]:
    """Cookie settings for testing."""
    return {
        "cookie_max_age": 172800,
        "cookie_secure": True,
        "cookie_httponly": True,
        "cookie_samesite": "Strict",
    }
