# ruff: noqa: ANN401
from collections.abc import Callable
from datetime import datetime, timedelta

import pytest
from django.conf import settings
from django.http import HttpRequest, HttpResponse
from jose import jwt
from jose.constants import ALGORITHMS

from main.account import AUTH_COOKIE_NAME, OAuthOrganization
from main.account.middleware import check_login_status_middleware
from main.account.models import User


@pytest.mark.django_db
class TestCheckLoginStatusMiddleware:
    @pytest.fixture
    def user(self) -> User:
        """Create a sample user for testing."""
        return User.objects.create_user(
            oauth_org=OAuthOrganization.GOOGLE,
            oauth_id="test_oauth_id",
            email="test@example.com",
            username="Test User",
        )

    @pytest.fixture
    def request_obj(self) -> HttpRequest:
        """Create a sample request object."""
        return HttpRequest()

    @pytest.fixture
    def middleware(self) -> Callable[[HttpRequest], HttpResponse]:
        """Create middleware instance for testing."""

        def mock_get_response(request: HttpRequest) -> HttpResponse:
            """Mock get_response function for testing."""
            return HttpResponse("Test response")

        return check_login_status_middleware(mock_get_response)

    def create_valid_token(self, user: User) -> str:
        """Helper method to create a valid JWT token."""
        payload = {
            "id": str(user.id),
            "oauth_id": user.oauth_id,
            "iat": int(datetime.now().timestamp()),
            "exp": int((datetime.now() + timedelta(days=30)).timestamp()),
        }
        return jwt.encode(payload, settings.SECRET_KEY, algorithm=ALGORITHMS.HS256)

    def test_middleware_no_token(
        self,
        middleware: Callable[[HttpRequest], HttpResponse],
        request_obj: HttpRequest,
    ) -> None:
        """Test middleware with no authentication token."""
        request_obj.COOKIES = {}

        response = middleware(request_obj)

        assert response.status_code == 200
        assert AUTH_COOKIE_NAME in response.cookies
        assert response.cookies[AUTH_COOKIE_NAME].value == ""

    def test_middleware_valid_token(
        self,
        middleware: Callable[[HttpRequest], HttpResponse],
        request_obj: HttpRequest,
        user: User,
    ) -> None:
        """Test middleware with valid authentication token."""
        token = self.create_valid_token(user)
        request_obj.COOKIES = {AUTH_COOKIE_NAME: token}

        response = middleware(request_obj)

        assert response.status_code == 200
        assert request_obj.user == user
        # Should refresh the cookie
        assert AUTH_COOKIE_NAME in response.cookies
        assert response.cookies[AUTH_COOKIE_NAME].value == token

    def test_middleware_invalid_token(
        self,
        middleware: Callable[[HttpRequest], HttpResponse],
        request_obj: HttpRequest,
    ) -> None:
        """Test middleware with invalid authentication token."""
        request_obj.COOKIES = {AUTH_COOKIE_NAME: "invalid_token"}

        response = middleware(request_obj)

        assert response.status_code == 200
        assert request_obj.user is None
        # Should delete the invalid cookie
        assert AUTH_COOKIE_NAME in response.cookies
        assert response.cookies[AUTH_COOKIE_NAME].value == ""

    def test_middleware_expired_token(
        self,
        middleware: Callable[[HttpRequest], HttpResponse],
        request_obj: HttpRequest,
        user: User,
    ) -> None:
        """Test middleware with expired authentication token."""
        payload = {
            "id": str(user.id),
            "oauth_id": user.oauth_id,
            "iat": int((datetime.now() - timedelta(days=2)).timestamp()),
            "exp": int((datetime.now() - timedelta(days=1)).timestamp()),
        }
        expired_token = jwt.encode(
            payload, settings.SECRET_KEY, algorithm=ALGORITHMS.HS256
        )
        request_obj.COOKIES = {AUTH_COOKIE_NAME: expired_token}

        response = middleware(request_obj)

        assert response.status_code == 200
        assert request_obj.user is None
        # Should delete the expired cookie
        assert AUTH_COOKIE_NAME in response.cookies
        assert response.cookies[AUTH_COOKIE_NAME].value == ""

    def test_middleware_nonexistent_user_token(
        self,
        middleware: Callable[[HttpRequest], HttpResponse],
        request_obj: HttpRequest,
    ) -> None:
        """Test middleware with token for non-existent user."""
        payload = {
            "id": "00000000-0000-0000-0000-000000000000",
            "oauth_id": "nonexistent_oauth_id",
            "iat": int(datetime.now().timestamp()),
            "exp": int((datetime.now() + timedelta(days=30)).timestamp()),
        }
        invalid_token = jwt.encode(
            payload, settings.SECRET_KEY, algorithm=ALGORITHMS.HS256
        )
        request_obj.COOKIES = {AUTH_COOKIE_NAME: invalid_token}

        response = middleware(request_obj)

        assert response.status_code == 200
        assert request_obj.user is None
        # Should delete the invalid cookie
        assert AUTH_COOKIE_NAME in response.cookies
        assert response.cookies[AUTH_COOKIE_NAME].value == ""

    def test_middleware_401_response(
        self, request_obj: HttpRequest, user: User
    ) -> None:
        """Test middleware with 401 response (should delete cookie)."""

        def mock_get_response_401(request: HttpRequest) -> HttpResponse:
            response = HttpResponse("Unauthorized", status=401)
            return response

        middleware = check_login_status_middleware(mock_get_response_401)
        token = self.create_valid_token(user)
        request_obj.COOKIES = {AUTH_COOKIE_NAME: token}

        response = middleware(request_obj)

        assert response.status_code == 401
        # Should delete the cookie on 401
        assert AUTH_COOKIE_NAME in response.cookies
        assert response.cookies[AUTH_COOKIE_NAME].value == ""

    def test_middleware_login_response(
        self, request_obj: HttpRequest, user: User
    ) -> None:
        """Test middleware with login response (should not modify cookie)."""

        def mock_get_response_login(request: HttpRequest) -> HttpResponse:
            response = HttpResponse("Login response")
            response["is-log-in"] = "yes"
            return response

        middleware = check_login_status_middleware(mock_get_response_login)
        token = self.create_valid_token(user)
        request_obj.COOKIES = {AUTH_COOKIE_NAME: token}

        response = middleware(request_obj)

        assert response.status_code == 200
        # Should not modify cookie on login response
        assert AUTH_COOKIE_NAME not in response.cookies
        # Custom header should be removed
        assert "is-log-in" not in response

    def test_middleware_logout_response(
        self, request_obj: HttpRequest, user: User
    ) -> None:
        """Test middleware with logout response (should not modify cookie)."""

        def mock_get_response_logout(request: HttpRequest) -> HttpResponse:
            response = HttpResponse("Logout response")
            response["is-log-out"] = "yes"
            return response

        middleware = check_login_status_middleware(mock_get_response_logout)
        token = self.create_valid_token(user)
        request_obj.COOKIES = {AUTH_COOKIE_NAME: token}

        response = middleware(request_obj)

        assert response.status_code == 200
        # Should not modify cookie on logout response
        assert AUTH_COOKIE_NAME not in response.cookies
        # Custom header should be removed
        assert "is-log-out" not in response

    def test_middleware_refresh_cookie(
        self,
        middleware: Callable[[HttpRequest], HttpResponse],
        request_obj: HttpRequest,
        user: User,
    ) -> None:
        """Test middleware refreshes cookie max_age."""
        token = self.create_valid_token(user)
        request_obj.COOKIES = {AUTH_COOKIE_NAME: token}

        response = middleware(request_obj)

        assert response.status_code == 200
        assert AUTH_COOKIE_NAME in response.cookies
        cookie = response.cookies[AUTH_COOKIE_NAME]
        assert cookie.value == token
        assert cookie["max-age"] == 172800
        assert cookie["secure"] is True
        assert cookie["httponly"] is True
        assert cookie["samesite"] == "Strict"

    def test_middleware_delete_cookie_when_no_token(
        self,
        middleware: Callable[[HttpRequest], HttpResponse],
        request_obj: HttpRequest,
    ) -> None:
        """Test middleware deletes cookie when no token is present."""
        request_obj.COOKIES = {}

        response = middleware(request_obj)

        assert response.status_code == 200
        assert AUTH_COOKIE_NAME in response.cookies
        assert response.cookies[AUTH_COOKIE_NAME].value == ""

    def test_middleware_with_other_cookies(
        self,
        middleware: Callable[[HttpRequest], HttpResponse],
        request_obj: HttpRequest,
        user: User,
    ) -> None:
        """Test middleware preserves other cookies."""
        token = self.create_valid_token(user)
        request_obj.COOKIES = {
            AUTH_COOKIE_NAME: token,
            "other_cookie": "other_value",
            "sessionid": "session_value",
        }

        response = middleware(request_obj)

        assert response.status_code == 200
        # Should not affect other cookies
        assert "other_cookie" not in response.cookies
        assert "sessionid" not in response.cookies

    def test_middleware_multiple_requests_same_user(
        self,
        middleware: Callable[[HttpRequest], HttpResponse],
        request_obj: HttpRequest,
        user: User,
    ) -> None:
        """Test middleware with multiple requests from same user."""
        token = self.create_valid_token(user)

        # First request
        request_obj.COOKIES = {AUTH_COOKIE_NAME: token}
        middleware(request_obj)

        # Second request
        request2 = HttpRequest()
        request2.COOKIES = {AUTH_COOKIE_NAME: token}
        middleware(request2)

        assert request_obj.user == user
        assert request2.user == user

    def test_middleware_different_users(
        self, request_obj: HttpRequest, user: User
    ) -> None:
        """Test middleware with different users."""
        # Create second user
        user2 = User.objects.create_user(
            oauth_org=OAuthOrganization.FACEGOOK,
            oauth_id="facebook_oauth_id",
            email="test2@example.com",
            username="Test User 2",
        )

        token1 = self.create_valid_token(user)
        token2 = self.create_valid_token(user2)

        # Request with first user's token
        request1 = HttpRequest()
        request1.COOKIES = {AUTH_COOKIE_NAME: token1}
        check_login_status_middleware(lambda req: HttpResponse("Test"))(request1)

        # Request with second user's token
        request2 = HttpRequest()
        request2.COOKIES = {AUTH_COOKIE_NAME: token2}
        check_login_status_middleware(lambda req: HttpResponse("Test"))(request2)

        assert request1.user == user
        assert request2.user == user2

    def test_middleware_custom_headers_removal(
        self, request_obj: HttpRequest, user: User
    ) -> None:
        """Test that custom headers are removed from response."""

        def mock_get_response_with_headers(request: HttpRequest) -> HttpResponse:
            response = HttpResponse("Response with headers")
            response["is-log-in"] = "yes"
            response["is-log-out"] = "yes"
            response["custom-header"] = "custom-value"
            return response

        middleware = check_login_status_middleware(mock_get_response_with_headers)
        token = self.create_valid_token(user)
        request_obj.COOKIES = {AUTH_COOKIE_NAME: token}

        response = middleware(request_obj)

        # Custom auth headers should be removed
        assert "is-log-in" not in response
        assert "is-log-out" not in response
        # Other headers should remain
        assert "custom-header" in response

    def test_middleware_empty_token(
        self,
        middleware: Callable[[HttpRequest], HttpResponse],
        request_obj: HttpRequest,
    ) -> None:
        """Test middleware with empty token string."""
        request_obj.COOKIES = {AUTH_COOKIE_NAME: ""}

        response = middleware(request_obj)

        assert response.status_code == 200
        assert request_obj.user is None
        # Should delete the empty cookie
        assert AUTH_COOKIE_NAME in response.cookies
        assert response.cookies[AUTH_COOKIE_NAME].value == ""

    def test_middleware_token_with_extra_whitespace(
        self,
        middleware: Callable[[HttpRequest], HttpResponse],
        request_obj: HttpRequest,
        user: User,
    ) -> None:
        """Test middleware with token containing extra whitespace."""
        token = self.create_valid_token(user)
        request_obj.COOKIES = {AUTH_COOKIE_NAME: f" {token} "}

        response = middleware(request_obj)

        assert response.status_code == 200
        # Should still work with whitespace
        assert request_obj.user == user
        assert AUTH_COOKIE_NAME in response.cookies
