# ruff: noqa: ANN401
import json
from unittest.mock import Mock, patch

import pytest
from django.http import HttpRequest, JsonResponse

from main.account import OAuthOrganization
from main.account.models import User
from main.core.decorators.rate_limit import rate_limit


@pytest.mark.django_db
class TestRateLimitDecorator:
    @pytest.fixture
    def authenticated_user(self) -> User:
        return User.objects.create_user(
            oauth_org=OAuthOrganization.GOOGLE,
            oauth_id="test_oauth_id",
            email="test@example.com",
            username="testuser",
        )

    @pytest.fixture
    def authenticated_request(self, authenticated_user: User) -> HttpRequest:
        request = HttpRequest()
        request.user = authenticated_user  # type: ignore[attr-defined]
        request.method = "GET"  # type: ignore[assignment]
        request.path = "/api/test"
        return request

    @pytest.fixture
    def unauthenticated_request(self) -> HttpRequest:
        request = HttpRequest()
        request.user = Mock()  # type: ignore[attr-defined]
        request.user.is_authenticated = False  # type: ignore[attr-defined]
        request.method = "POST"  # type: ignore[assignment]
        request.path = "/api/test"
        return request

    @pytest.fixture
    def anonymous_user_request(self) -> HttpRequest:
        request = HttpRequest()
        # No user attribute
        request.method = "GET"  # type: ignore[assignment]
        request.path = "/api/test"
        return request

    @patch("main.core.decorators.rate_limit.LUA_SCRIPT")
    def test_rate_limit_allows_request_when_under_limit(
        self, mock_lua_script: Mock, authenticated_request: HttpRequest
    ) -> None:
        """Test that requests are allowed when rate limit is not exceeded."""
        mock_lua_script.return_value = 1  # Allowed

        @rate_limit(rate=10.0, capacity=20)
        def test_view(request: HttpRequest) -> JsonResponse:
            return JsonResponse({"message": "success"})

        response = test_view(authenticated_request)

        assert isinstance(response, JsonResponse)
        assert response.status_code == 200
        response_data = json.loads(response.content.decode("utf-8"))
        assert response_data["message"] == "success"
        mock_lua_script.assert_called_once()
        call_args = mock_lua_script.call_args
        expected_key = f"rate_limit:GET:/api/test:{authenticated_request.user.id}"
        assert call_args.kwargs["keys"] == [expected_key]
        assert call_args.kwargs["args"] == [10.0, 20]

    @patch("main.core.decorators.rate_limit.LUA_SCRIPT")
    def test_rate_limit_blocks_request_when_exceeded(
        self, mock_lua_script: Mock, authenticated_request: HttpRequest
    ) -> None:
        """Test that requests are blocked when rate limit is exceeded."""
        mock_lua_script.return_value = 0  # Not allowed

        @rate_limit(rate=10.0, capacity=20)
        def test_view(request: HttpRequest) -> JsonResponse:
            return JsonResponse({"message": "success"})

        response = test_view(authenticated_request)

        assert isinstance(response, JsonResponse)
        assert response.status_code == 429
        response_data = json.loads(response.content.decode("utf-8"))
        assert response_data["message"] == "Rate Limit Exceeded"
        mock_lua_script.assert_called_once()

    @patch("main.core.decorators.rate_limit.LUA_SCRIPT")
    def test_rate_limit_with_anonymous_user(
        self, mock_lua_script: Mock, anonymous_user_request: HttpRequest
    ) -> None:
        """Test that anonymous users are handled correctly."""
        mock_lua_script.return_value = 1  # Allowed

        @rate_limit(rate=5.0, capacity=10)
        def test_view(request: HttpRequest) -> JsonResponse:
            return JsonResponse({"message": "success"})

        response = test_view(anonymous_user_request)

        assert isinstance(response, JsonResponse)
        assert response.status_code == 200
        call_args = mock_lua_script.call_args
        assert call_args.kwargs["keys"] == ["rate_limit:GET:/api/test:anonymous"]
        assert call_args.kwargs["args"] == [5.0, 10]

    @patch("main.core.decorators.rate_limit.LUA_SCRIPT")
    def test_rate_limit_with_unauthenticated_user(
        self, mock_lua_script: Mock, unauthenticated_request: HttpRequest
    ) -> None:
        """Test that unauthenticated users are handled correctly."""
        mock_lua_script.return_value = 1  # Allowed

        @rate_limit(rate=5.0)
        def test_view(request: HttpRequest) -> JsonResponse:
            return JsonResponse({"message": "success"})

        response = test_view(unauthenticated_request)

        assert isinstance(response, JsonResponse)
        assert response.status_code == 200
        call_args = mock_lua_script.call_args
        assert call_args.kwargs["keys"] == ["rate_limit:POST:/api/test:anonymous"]
        assert call_args.kwargs["args"] == [5.0, 5]  # capacity defaults to ceil(rate)

    @patch("main.core.decorators.rate_limit.LUA_SCRIPT")
    def test_rate_limit_key_includes_method_and_path(
        self, mock_lua_script: Mock, authenticated_user: User
    ) -> None:
        """Test that rate limit key includes HTTP method and path."""
        mock_lua_script.return_value = 1

        @rate_limit(rate=10.0)
        def test_view(request: HttpRequest) -> JsonResponse:
            return JsonResponse({"message": "success"})

        # Test different methods and paths
        for method, path in [
            ("GET", "/api/users"),
            ("POST", "/api/users"),
            ("GET", "/api/posts"),
        ]:
            request = HttpRequest()
            request.user = authenticated_user  # type: ignore[attr-defined]
            request.method = method  # type: ignore[assignment]
            request.path = path

            test_view(request)

            # Check the last call
            call_args = mock_lua_script.call_args
            expected_key = f"rate_limit:{method}:{path}:{authenticated_user.id}"
            assert call_args.kwargs["keys"] == [expected_key]

    @patch("main.core.decorators.rate_limit.LUA_SCRIPT")
    def test_rate_limit_default_capacity(
        self, mock_lua_script: Mock, authenticated_request: HttpRequest
    ) -> None:
        """Test that capacity defaults to ceil(rate) when not provided."""
        mock_lua_script.return_value = 1

        @rate_limit(rate=10.5)
        def test_view(request: HttpRequest) -> JsonResponse:
            return JsonResponse({"message": "success"})

        test_view(authenticated_request)

        call_args = mock_lua_script.call_args
        assert call_args.kwargs["args"] == [10.5, 11]  # ceil(10.5) = 11

    @patch("main.core.decorators.rate_limit.LUA_SCRIPT")
    def test_rate_limit_with_custom_capacity(
        self, mock_lua_script: Mock, authenticated_request: HttpRequest
    ) -> None:
        """Test that custom capacity is used when provided."""
        mock_lua_script.return_value = 1

        @rate_limit(rate=10.0, capacity=50)
        def test_view(request: HttpRequest) -> JsonResponse:
            return JsonResponse({"message": "success"})

        test_view(authenticated_request)

        call_args = mock_lua_script.call_args
        assert call_args.kwargs["args"] == [10.0, 50]

    @patch("main.core.decorators.rate_limit.LUA_SCRIPT")
    def test_rate_limit_preserves_view_functionality(
        self, mock_lua_script: Mock, authenticated_request: HttpRequest
    ) -> None:
        """Test that the decorator preserves the original view function behavior."""
        mock_lua_script.return_value = 1

        @rate_limit(rate=10.0)
        def test_view(request: HttpRequest) -> JsonResponse:
            return JsonResponse({"data": {"user_id": request.user.id}})  # type: ignore[attr-defined]

        response = test_view(authenticated_request)

        assert response.status_code == 200
        response_data = json.loads(response.content.decode("utf-8"))
        assert str(response_data["data"]["user_id"]) == str(
            authenticated_request.user.id
        )  # type: ignore[attr-defined]

    @patch("main.core.decorators.rate_limit.LUA_SCRIPT")
    def test_rate_limit_with_different_users(
        self, mock_lua_script: Mock, authenticated_user: User
    ) -> None:
        """Test that different users have separate rate limits."""
        mock_lua_script.return_value = 1

        @rate_limit(rate=10.0)
        def test_view(request: HttpRequest) -> JsonResponse:
            return JsonResponse({"message": "success"})

        # Create another user
        user2 = User.objects.create_user(
            oauth_org=OAuthOrganization.GOOGLE,
            oauth_id="test_oauth_id_2",
            email="test2@example.com",
            username="testuser2",
        )

        request1 = HttpRequest()
        request1.user = authenticated_user  # type: ignore[attr-defined]
        request1.method = "GET"  # type: ignore[assignment]
        request1.path = "/api/test"

        request2 = HttpRequest()
        request2.user = user2  # type: ignore[attr-defined]
        request2.method = "GET"  # type: ignore[assignment]
        request2.path = "/api/test"

        test_view(request1)
        test_view(request2)

        # Check that different keys were used
        assert mock_lua_script.call_count == 2
        call1_key = mock_lua_script.call_args_list[0].kwargs["keys"][0]
        call2_key = mock_lua_script.call_args_list[1].kwargs["keys"][0]
        assert call1_key != call2_key
        assert f":{authenticated_user.id}" in call1_key
        assert f":{user2.id}" in call2_key
