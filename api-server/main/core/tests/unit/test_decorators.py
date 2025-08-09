# ruff: noqa: ANN401
from typing import Any
from unittest.mock import Mock

import pytest
from django.http import HttpRequest, JsonResponse

from main.account import OAuthOrganization
from main.account.models import User
from main.core.decorators import require_login


@pytest.mark.django_db
class TestRequireLoginDecorator:
    @pytest.fixture
    def authenticated_user(self) -> User:
        return User.objects.create_user(
            oauth_org=OAuthOrganization.GOOGLE,
            oauth_id="test_oauth_id",
            email="test@example.com",
            username="Test User",
        )

    @pytest.fixture
    def authenticated_request(self, authenticated_user: User) -> HttpRequest:
        request = HttpRequest()
        request.user = authenticated_user
        return request

    @pytest.fixture
    def unauthenticated_request(self) -> HttpRequest:
        request = HttpRequest()
        request.user = Mock()
        request.user.is_authenticated = False
        return request

    @pytest.fixture
    def anonymous_request(self) -> HttpRequest:
        request = HttpRequest()
        # Simulate AnonymousUser which is not an instance of User
        request.user = Mock()
        request.user.is_authenticated = (
            True  # Even if authenticated, not a User instance
        )
        return request

    def test_require_login_with_authenticated_user(
        self, authenticated_request: HttpRequest
    ) -> None:
        @require_login
        def test_view(request: HttpRequest) -> JsonResponse:
            return JsonResponse({"message": "success"})

        response = test_view(authenticated_request)

        assert isinstance(response, JsonResponse)
        assert response.status_code == 200
        import json

        response_data = json.loads(response.content.decode("utf-8"))
        assert response_data["message"] == "success"

    def test_require_login_with_unauthenticated_user(
        self, unauthenticated_request: HttpRequest
    ) -> None:
        @require_login
        def test_view(request: HttpRequest) -> JsonResponse:
            return JsonResponse({"message": "success"})

        response = test_view(unauthenticated_request)

        assert isinstance(response, JsonResponse)
        assert response.status_code == 401
        import json

        response_data = json.loads(response.content.decode("utf-8"))
        assert response_data["message"] == "Login Required"

    def test_require_login_with_non_user_instance(
        self, anonymous_request: HttpRequest
    ) -> None:
        @require_login
        def test_view(request: HttpRequest) -> JsonResponse:
            return JsonResponse({"message": "success"})

        response = test_view(anonymous_request)

        assert isinstance(response, JsonResponse)
        assert response.status_code == 401
        import json

        response_data = json.loads(response.content.decode("utf-8"))
        assert response_data["message"] == "Login Required"

    def test_require_login_preserves_function_name(self) -> None:
        @require_login
        def test_view_name(request: HttpRequest) -> JsonResponse:
            return JsonResponse({"message": "success"})

        assert test_view_name.__name__ == "test_view_name"

    def test_require_login_with_args_and_kwargs(
        self, authenticated_request: HttpRequest
    ) -> None:
        @require_login
        def test_view(request: HttpRequest, *args: Any, **kwargs: Any) -> JsonResponse:
            return JsonResponse(
                {
                    "args": list(args),
                    "kwargs": kwargs,
                }
            )

        response = test_view(
            authenticated_request, "arg1", "arg2", key1="value1", key2="value2"
        )

        assert isinstance(response, JsonResponse)
        assert response.status_code == 200
        import json

        response_data = json.loads(response.content.decode("utf-8"))
        assert response_data["args"] == ["arg1", "arg2"]
        assert response_data["kwargs"] == {"key1": "value1", "key2": "value2"}

    def test_require_login_with_view_that_raises_exception(
        self, authenticated_request: HttpRequest
    ) -> None:
        @require_login
        def test_view(request: HttpRequest) -> JsonResponse:
            raise ValueError("Test exception")

        with pytest.raises(ValueError, match="Test exception"):
            test_view(authenticated_request)
