# ruff: noqa: ANN401
from collections.abc import Callable
from datetime import datetime, timedelta

import pytest
from django.conf import settings
from django.http import HttpRequest, HttpResponse
from jose import jwt

from main.account import ACCESS_COOKIE_NAME, OAuthOrganization
from main.account.cookies import delete_auth_cookies, set_access_cookie
from main.account.middleware import check_login_status_middleware
from main.account.models import User


@pytest.mark.django_db
class TestCheckLoginStatusMiddleware:
    @pytest.fixture
    def user(self) -> User:
        return User.objects.create_user(
            oauth_org=OAuthOrganization.GOOGLE,
            oauth_id="test_oauth_id",
            email="test@example.com",
            username="Test User",
        )

    @pytest.fixture
    def request_obj(self) -> HttpRequest:
        return HttpRequest()

    @pytest.fixture
    def middleware(self) -> Callable[[HttpRequest], HttpResponse]:
        def mock_get_response(request: HttpRequest) -> HttpResponse:
            return HttpResponse(b"Test response")

        return check_login_status_middleware(mock_get_response)

    def create_valid_token(self, user: User) -> str:
        payload = {
            "id": str(user.id),
            "exp": int((datetime.now() + timedelta(days=30)).timestamp()),
        }
        return jwt.encode(
            payload, settings.SECRET_KEY, algorithm=settings.JWT_ALGORITHM
        )

    def test_middleware_no_token(
        self,
        middleware: Callable[[HttpRequest], HttpResponse],
        request_obj: HttpRequest,
    ) -> None:
        request_obj.COOKIES = {}

        response = middleware(request_obj)

        assert response.status_code == 200
        assert ACCESS_COOKIE_NAME not in response.cookies

    def test_middleware_valid_token(
        self,
        middleware: Callable[[HttpRequest], HttpResponse],
        request_obj: HttpRequest,
        user: User,
    ) -> None:
        token = self.create_valid_token(user)
        request_obj.COOKIES = {ACCESS_COOKIE_NAME: token}

        response = middleware(request_obj)

        assert response.status_code == 200
        assert request_obj.user == user
        # A short-lived access token must not be extended by normal API traffic.
        assert ACCESS_COOKIE_NAME not in response.cookies

    def test_middleware_invalid_token(
        self,
        middleware: Callable[[HttpRequest], HttpResponse],
        request_obj: HttpRequest,
    ) -> None:
        request_obj.COOKIES = {ACCESS_COOKIE_NAME: "invalid_token"}

        response = middleware(request_obj)

        assert response.status_code == 200
        assert request_obj.user is None
        # Should delete the invalid cookie
        assert ACCESS_COOKIE_NAME in response.cookies
        assert response.cookies[ACCESS_COOKIE_NAME].value == ""

    def test_middleware_expired_token(
        self,
        middleware: Callable[[HttpRequest], HttpResponse],
        request_obj: HttpRequest,
        user: User,
    ) -> None:
        payload = {
            "id": str(user.id),
            "exp": int((datetime.now() - timedelta(days=1)).timestamp()),
        }
        expired_token = jwt.encode(
            payload, settings.SECRET_KEY, algorithm=settings.JWT_ALGORITHM
        )
        request_obj.COOKIES = {ACCESS_COOKIE_NAME: expired_token}

        response = middleware(request_obj)

        assert response.status_code == 200
        assert request_obj.user is None
        # Should delete the expired cookie
        assert ACCESS_COOKIE_NAME in response.cookies
        assert response.cookies[ACCESS_COOKIE_NAME].value == ""

    def test_middleware_401_response(
        self, request_obj: HttpRequest, user: User
    ) -> None:
        def mock_get_response_401(request: HttpRequest) -> HttpResponse:
            response = HttpResponse("Unauthorized", status=401)
            return response

        middleware = check_login_status_middleware(mock_get_response_401)
        token = self.create_valid_token(user)
        request_obj.COOKIES = {ACCESS_COOKIE_NAME: token}

        response = middleware(request_obj)

        assert response.status_code == 401
        # Should delete the cookie on 401
        assert ACCESS_COOKIE_NAME in response.cookies
        assert response.cookies[ACCESS_COOKIE_NAME].value == ""

    def test_middleware_auth_cookie_response(
        self, request_obj: HttpRequest, user: User
    ) -> None:
        def mock_get_response_login(request: HttpRequest) -> HttpResponse:
            response = HttpResponse("Login response")
            return set_access_cookie(response, "new_token")

        middleware = check_login_status_middleware(mock_get_response_login)
        token = self.create_valid_token(user)
        request_obj.COOKIES = {ACCESS_COOKIE_NAME: token}

        response = middleware(request_obj)

        assert response.status_code == 200
        assert response.cookies[ACCESS_COOKIE_NAME].value == "new_token"

    def test_middleware_deleted_auth_cookie_response(
        self, request_obj: HttpRequest, user: User
    ) -> None:
        def mock_get_response_logout(request: HttpRequest) -> HttpResponse:
            response = HttpResponse("Logout response")
            return delete_auth_cookies(response)

        middleware = check_login_status_middleware(mock_get_response_logout)
        token = self.create_valid_token(user)
        request_obj.COOKIES = {ACCESS_COOKIE_NAME: token}

        response = middleware(request_obj)

        assert response.status_code == 200
        assert response.cookies[ACCESS_COOKIE_NAME].value == ""

    def test_middleware_does_not_refresh_access_cookie(
        self,
        middleware: Callable[[HttpRequest], HttpResponse],
        request_obj: HttpRequest,
        user: User,
    ) -> None:
        token = self.create_valid_token(user)
        request_obj.COOKIES = {ACCESS_COOKIE_NAME: token}

        response = middleware(request_obj)

        assert response.status_code == 200
        assert ACCESS_COOKIE_NAME not in response.cookies
