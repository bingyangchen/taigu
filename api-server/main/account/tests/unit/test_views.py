# ruff: noqa: ANN401, S105
import json
from json.decoder import JSONDecodeError
from typing import Any
from unittest.mock import Mock, patch

import pytest
from django.core.exceptions import ValidationError
from django.http import HttpRequest, QueryDict

from main.account import AUTH_COOKIE_NAME, OAuthOrganization
from main.account.models import User
from main.account.views import (
    change_google_binding,
    get_authorization_url,
    google_login,
    logout,
    me,
    update,
)


@pytest.mark.django_db
class TestGetAuthorizationUrlView:
    @pytest.fixture
    def request_obj(self) -> HttpRequest:
        return HttpRequest()

    @pytest.fixture
    def mock_flow(self) -> Any:
        mock = Mock()
        mock.client_config = {"client_id": "test_client_id"}
        mock.credentials = Mock()
        mock.credentials.id_token = "test_id_token"
        return mock

    def test_get_authorization_url_success(
        self, monkeypatch: Any, request_obj: HttpRequest, mock_flow: Any
    ) -> None:
        # Mock the Google OAuth flow
        mock_flow_from_config = Mock(return_value=mock_flow)
        mock_flow.authorization_url.return_value = ("https://auth.url", "state123")

        monkeypatch.setattr(
            "main.account.views.google_oauth_flow.Flow.from_client_config",
            mock_flow_from_config,
        )

        request_obj.method = "GET"
        # Set GET parameters using QueryDict
        request_obj.GET = QueryDict("redirect_uri=https://example.com/callback")

        response = get_authorization_url(request_obj)

        assert response.status_code == 200
        data = json.loads(response.content)
        assert data["authorization_url"] == "https://auth.url"
        assert data["state"] == "state123"
        mock_flow.authorization_url.assert_called_once_with(
            include_granted_scopes="true"
        )

    @patch("main.core.decorators.rate_limit.LUA_SCRIPT")
    def test_get_authorization_url_missing_redirect_uri(
        self, mock_lua_script: Mock, request_obj: HttpRequest
    ) -> None:
        mock_lua_script.return_value = 1  # Allow request
        request_obj.method = "GET"
        request_obj.GET = QueryDict("")

        response = get_authorization_url(request_obj)

        assert response.status_code == 400
        data = json.loads(response.content)
        assert data["message"] == "redirect_uri is required"


@pytest.mark.django_db
class TestGoogleLoginView:
    @pytest.fixture
    def request_obj(self) -> HttpRequest:
        return HttpRequest()

    @pytest.fixture
    def mock_flow(self) -> Any:
        mock = Mock()
        mock.client_config = {"client_id": "test_client_id"}
        mock.credentials = Mock()
        mock.credentials.id_token = "test_id_token"
        return mock

    @pytest.fixture
    def mock_credentials(self) -> Any:
        return Mock()

    @pytest.fixture
    def mock_verify_result(self) -> dict[str, Any]:
        return {
            "sub": "test_oauth_id",
            "email": "test@example.com",
            "name": "Test User",
            "picture": "https://example.com/avatar.jpg",
        }

    def test_google_login_post_success_new_user(
        self,
        monkeypatch: Any,
        request_obj: HttpRequest,
        mock_flow: Any,
        mock_verify_result: dict[str, Any],
    ) -> None:
        # Mock all the required functions
        mock_flow_from_config = Mock(return_value=mock_flow)
        mock_verify_token = Mock(return_value=mock_verify_result)
        mock_jwt_encode = Mock(return_value="test_jwt_token")

        monkeypatch.setattr(
            "main.account.views.google_oauth_flow.Flow.from_client_config",
            mock_flow_from_config,
        )
        monkeypatch.setattr(
            "main.account.views.id_token.verify_oauth2_token", mock_verify_token
        )
        monkeypatch.setattr("main.account.views.jwt.encode", mock_jwt_encode)

        request_obj.method = "POST"
        request_obj.POST = {
            "code": "auth_code",
            "redirect_uri": "https://example.com/callback",
        }

        response = google_login(request_obj)

        assert response.status_code == 200
        assert response["is-log-in"] == "yes"
        assert AUTH_COOKIE_NAME in response.cookies
        assert response.cookies[AUTH_COOKIE_NAME].value == "test_jwt_token"

    @patch("main.core.decorators.rate_limit.LUA_SCRIPT")
    def test_google_login_post_success_existing_user(
        self,
        mock_lua_script: Mock,
        monkeypatch: Any,
        request_obj: HttpRequest,
        mock_flow: Any,
        mock_verify_result: dict[str, Any],
    ) -> None:
        mock_lua_script.return_value = 1  # Allow request
        # Create existing user
        User.objects.create_user(
            oauth_org=OAuthOrganization.GOOGLE,
            oauth_id="test_oauth_id",
            email="test@example.com",
            username="Test User",
        )

        # Mock all the required functions
        mock_flow_from_config = Mock(return_value=mock_flow)
        mock_verify_token = Mock(return_value=mock_verify_result)
        mock_jwt_encode = Mock(return_value="test_jwt_token")

        monkeypatch.setattr(
            "main.account.views.google_oauth_flow.Flow.from_client_config",
            mock_flow_from_config,
        )
        monkeypatch.setattr(
            "main.account.views.id_token.verify_oauth2_token", mock_verify_token
        )
        monkeypatch.setattr("main.account.views.jwt.encode", mock_jwt_encode)

        request_obj.method = "POST"
        request_obj.POST = {
            "code": "auth_code",
            "redirect_uri": "https://example.com/callback",
        }

        response = google_login(request_obj)

        assert response.status_code == 200
        assert response["is-log-in"] == "yes"
        assert AUTH_COOKIE_NAME in response.cookies

    @patch("main.core.decorators.rate_limit.LUA_SCRIPT")
    def test_google_login_insufficient_data(
        self, mock_lua_script: Mock, request_obj: HttpRequest
    ) -> None:
        mock_lua_script.return_value = 1  # Allow request
        request_obj.method = "POST"
        request_obj.POST = {"code": "auth_code"}  # Missing redirect_uri

        response = google_login(request_obj)

        assert response.status_code == 400
        data = json.loads(response.content)
        assert data["message"] == "Data Not Sufficient"

    @patch("main.core.decorators.rate_limit.LUA_SCRIPT")
    def test_google_login_missing_code(
        self, mock_lua_script: Mock, request_obj: HttpRequest
    ) -> None:
        mock_lua_script.return_value = 1  # Allow request
        request_obj.method = "POST"
        request_obj.POST = {
            "redirect_uri": "https://example.com/callback"
        }  # Missing code

        response = google_login(request_obj)

        assert response.status_code == 400
        data = json.loads(response.content)
        assert data["message"] == "Data Not Sufficient"


@pytest.mark.django_db
class TestChangeGoogleBindingView:
    @pytest.fixture
    def user(self) -> User:
        return User.objects.create_user(
            oauth_org=OAuthOrganization.FACEGOOK,
            oauth_id="facebook_oauth_id",
            email="test@example.com",
            username="Test User",
        )

    @pytest.fixture
    def request_obj(self, user: User) -> HttpRequest:
        request = HttpRequest()
        request.user = user
        return request

    @pytest.fixture
    def mock_flow(self) -> Any:
        mock = Mock()
        mock.client_config = {"client_id": "test_client_id"}
        mock.credentials = Mock()
        mock.credentials.id_token = "test_id_token"
        return mock

    @pytest.fixture
    def mock_credentials(self) -> Any:
        return Mock()

    @pytest.fixture
    def mock_verify_result(self) -> dict[str, Any]:
        return {
            "sub": "new_google_oauth_id",
            "email": "new@example.com",
            "name": "New User",
            "picture": "https://example.com/new_avatar.jpg",
        }

    def test_change_google_binding_success(
        self,
        monkeypatch: Any,
        request_obj: HttpRequest,
        mock_flow: Any,
        mock_verify_result: dict[str, Any],
    ) -> None:
        # Mock all the required functions
        mock_flow_from_config = Mock(return_value=mock_flow)
        mock_verify_token = Mock(return_value=mock_verify_result)
        mock_jwt_encode = Mock(return_value="test_jwt_token")

        monkeypatch.setattr(
            "main.account.views.google_oauth_flow.Flow.from_client_config",
            mock_flow_from_config,
        )
        monkeypatch.setattr(
            "main.account.views.id_token.verify_oauth2_token", mock_verify_token
        )
        monkeypatch.setattr("main.account.views.jwt.encode", mock_jwt_encode)

        request_obj.method = "POST"
        request_obj.POST = {
            "code": "auth_code",
            "redirect_uri": "https://example.com/callback",
        }

        response = change_google_binding(request_obj)

        assert response.status_code == 200
        data = json.loads(response.content)
        assert data["id"] == str(request_obj.user.id)
        assert data["email"] == "new@example.com"
        assert data["username"] == "New User"
        assert data["avatar_url"] == "https://example.com/new_avatar.jpg"
        assert response["is-log-in"] == "yes"
        assert AUTH_COOKIE_NAME in response.cookies

    def test_change_google_binding_already_bound(
        self,
        monkeypatch: Any,
        request_obj: HttpRequest,
        mock_flow: Any,
        mock_verify_result: dict[str, Any],
    ) -> None:
        # Create another user with the same Google oauth_id
        User.objects.create_user(
            oauth_org=OAuthOrganization.GOOGLE,
            oauth_id="new_google_oauth_id",
            email="existing@example.com",
            username="Existing User",
        )

        # Mock all the required functions
        mock_flow_from_config = Mock(return_value=mock_flow)
        mock_verify_token = Mock(return_value=mock_verify_result)

        monkeypatch.setattr(
            "main.account.views.google_oauth_flow.Flow.from_client_config",
            mock_flow_from_config,
        )
        monkeypatch.setattr(
            "main.account.views.id_token.verify_oauth2_token", mock_verify_token
        )

        request_obj.method = "POST"
        request_obj.POST = {
            "code": "auth_code",
            "redirect_uri": "https://example.com/callback",
        }

        response = change_google_binding(request_obj)

        assert response.status_code == 400
        data = json.loads(response.content)
        assert (
            data["message"]
            == "This Google account is already bound to another account."
        )

    def test_change_google_binding_insufficient_data(
        self, request_obj: HttpRequest
    ) -> None:
        request_obj.method = "POST"
        request_obj.POST = {"code": "auth_code"}  # Missing redirect_uri

        response = change_google_binding(request_obj)

        assert response.status_code == 400
        data = json.loads(response.content)
        assert data["message"] == "Data Not Sufficient"


@pytest.mark.django_db
class TestMeView:
    @pytest.fixture
    def user(self) -> User:
        return User.objects.create_user(
            oauth_org=OAuthOrganization.GOOGLE,
            oauth_id="test_oauth_id",
            email="test@example.com",
            username="Test User",
            avatar_url="https://example.com/avatar.jpg",
        )

    @pytest.fixture
    def request_obj(self, user: User) -> HttpRequest:
        request = HttpRequest()
        request.user = user
        return request

    def test_me_success(self, request_obj: HttpRequest) -> None:
        request_obj.method = "GET"
        response = me(request_obj)

        assert response.status_code == 200
        data = json.loads(response.content)
        assert data["id"] == str(request_obj.user.id)
        assert data["username"] == "Test User"
        assert data["email"] == "test@example.com"
        assert data["avatar_url"] == "https://example.com/avatar.jpg"

    def test_me_without_avatar(self, request_obj: HttpRequest, user: User) -> None:
        user.avatar_url = None
        user.save()

        request_obj.method = "GET"
        response = me(request_obj)

        assert response.status_code == 200
        data = json.loads(response.content)
        assert data["avatar_url"] is None


@pytest.mark.django_db
class TestLogoutView:
    @pytest.fixture
    def user(self) -> User:
        return User.objects.create_user(
            oauth_org=OAuthOrganization.GOOGLE,
            oauth_id="test_oauth_id",
            email="test@example.com",
            username="Test User",
        )

    @pytest.fixture
    def request_obj(self, user: User) -> HttpRequest:
        request = HttpRequest()
        request.user = user
        return request

    def test_logout_success(self, request_obj: HttpRequest) -> None:
        request_obj.method = "GET"
        response = logout(request_obj)

        assert response.status_code == 200
        assert response["is-log-out"] == "yes"
        # Check that cookie is deleted
        assert response.cookies[AUTH_COOKIE_NAME].value == ""


@pytest.mark.django_db
class TestUpdateView:
    @pytest.fixture
    def user(self) -> User:
        return User.objects.create_user(
            oauth_org=OAuthOrganization.GOOGLE,
            oauth_id="test_oauth_id",
            email="test@example.com",
            username="Test User",
            avatar_url="https://example.com/avatar.jpg",
        )

    @pytest.fixture
    def request_obj(self, user: User) -> HttpRequest:
        request = HttpRequest()
        request.user = user
        return request

    def test_update_username_success(
        self, request_obj: HttpRequest, user: User
    ) -> None:
        request_obj.method = "POST"
        body_data = json.dumps({"username": "New Username"}).encode()
        request_obj._body = body_data

        response = update(request_obj)

        assert response.status_code == 200
        data = json.loads(response.content)
        assert data["username"] == "New Username"
        assert data["email"] == "test@example.com"
        assert data["avatar_url"] == "https://example.com/avatar.jpg"

        # Verify user was updated in database
        user.refresh_from_db()
        assert user.username == "New Username"

    def test_update_avatar_url_success(
        self, request_obj: HttpRequest, user: User
    ) -> None:
        request_obj.method = "POST"
        body_data = json.dumps(
            {"avatar_url": "https://example.com/new_avatar.jpg"}
        ).encode()
        request_obj._body = body_data

        response = update(request_obj)

        assert response.status_code == 200
        data = json.loads(response.content)
        assert data["avatar_url"] == "https://example.com/new_avatar.jpg"

        # Verify user was updated in database
        user.refresh_from_db()
        assert user.avatar_url == "https://example.com/new_avatar.jpg"

    def test_update_avatar_url_to_empty(
        self, request_obj: HttpRequest, user: User
    ) -> None:
        request_obj.method = "POST"
        body_data = json.dumps({"avatar_url": ""}).encode()
        request_obj._body = body_data

        response = update(request_obj)

        assert response.status_code == 200
        data = json.loads(response.content)
        assert data["avatar_url"] is None

        # Verify user was updated in database
        user.refresh_from_db()
        assert user.avatar_url is None

    def test_update_multiple_fields(self, request_obj: HttpRequest, user: User) -> None:
        request_obj.method = "POST"
        body_data = json.dumps(
            {
                "username": "New Username",
                "avatar_url": "https://example.com/new_avatar.jpg",
            }
        ).encode()
        request_obj._body = body_data

        response = update(request_obj)

        assert response.status_code == 200
        data = json.loads(response.content)
        assert data["username"] == "New Username"
        assert data["avatar_url"] == "https://example.com/new_avatar.jpg"

        # Verify user was updated in database
        user.refresh_from_db()
        assert user.username == "New Username"
        assert user.avatar_url == "https://example.com/new_avatar.jpg"

    def test_update_no_fields(self, request_obj: HttpRequest) -> None:
        request_obj.method = "POST"
        body_data = json.dumps({}).encode()
        request_obj._body = body_data

        response = update(request_obj)

        assert response.status_code == 200
        data = json.loads(response.content)
        assert data["username"] == "Test User"
        assert data["email"] == "test@example.com"
        assert data["avatar_url"] == "https://example.com/avatar.jpg"

    def test_update_invalid_json(self, request_obj: HttpRequest) -> None:
        request_obj.method = "POST"
        request_obj._body = b"invalid json"

        with pytest.raises(JSONDecodeError):
            update(request_obj)

    def test_update_validation_error(
        self, monkeypatch: Any, request_obj: HttpRequest
    ) -> None:
        mock_save = Mock()
        mock_save.side_effect = ValidationError("Invalid username")

        monkeypatch.setattr("main.account.models.User.save", mock_save)

        request_obj.method = "POST"
        body_data = json.dumps({"username": "Invalid Username"}).encode()
        request_obj._body = body_data

        response = update(request_obj)

        assert response.status_code == 400
        data = json.loads(response.content)
        assert data["message"] == "Invalid username"

    def test_update_unsupported_field(
        self, request_obj: HttpRequest, user: User
    ) -> None:
        request_obj.method = "POST"
        body_data = json.dumps({"email": "new@example.com"}).encode()
        request_obj._body = body_data

        response = update(request_obj)

        assert response.status_code == 200
        data = json.loads(response.content)
        # Email should not be updated
        assert data["email"] == "test@example.com"

        # Verify user was not updated in database
        user.refresh_from_db()
        assert user.email == "test@example.com"
