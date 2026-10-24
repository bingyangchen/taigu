# ruff: noqa: ANN401, S105
import hashlib
import json
from base64 import urlsafe_b64encode
from datetime import UTC, date, datetime, timedelta
from json.decoder import JSONDecodeError
from typing import Any
from unittest.mock import Mock, patch
from urllib.parse import parse_qs, urlparse
from zoneinfo import ZoneInfo

import pytest
import requests
from django.conf import settings
from django.core import signing
from django.core.exceptions import ValidationError
from django.http import HttpRequest, HttpResponse, QueryDict
from django.test import Client
from django.utils import timezone
from google.auth import exceptions as google_auth_exceptions
from jose import jwt

from main.account import (
    ACCESS_COOKIE_NAME,
    OAUTH_COOKIE_NAME,
    REFRESH_COOKIE_NAME,
    OAuthOrganization,
)
from main.account.cookies import (
    LEGACY_REFRESH_COOKIE_NAME,
    OAUTH_COOKIE_MAX_AGE,
    OAUTH_COOKIE_PATH,
    OAUTH_COOKIE_SALT,
)
from main.account.models import User
from main.account.tokens import issue_token_pair
from main.account.views import (
    GOOGLE_BINDING_FAILED_MESSAGE,
    GOOGLE_LOGIN_FAILED_MESSAGE,
    change_google_binding,
    get_authorization_url,
    google_login,
    logout,
    me,
    open_session,
    refresh_token,
    update,
)
from main.billing.models import (
    BillingProfile,
    Plan,
    StandardWhitelist,
    SubscriptionStatus,
)
from main.usage.models import DailyActivity

TAIPEI = ZoneInfo("Asia/Taipei")
LOGIN_REDIRECT_URI = "https://local.taigu.tw/login"
BINDING_REDIRECT_URI = "https://local.taigu.tw/settings/account-binding"


class FakeGoogle:
    def __init__(self) -> None:
        self.token_status = 200
        self.token_error_code = "invalid_grant"
        self.token_error: Exception | None = None
        self.verify_error: Exception | None = None
        self.claims = {
            "sub": "google_oauth_id",
            "email": "google@example.com",
            "name": "Google User",
            "picture": "https://example.com/google_avatar.jpg",
        }
        self.token_requests: list[dict[str, str]] = []

    def request(self, method: str, url: str, **kwargs: Any) -> requests.Response:
        self.token_requests.append(kwargs["data"])
        if self.token_error:
            raise self.token_error
        response = requests.Response()
        response.status_code = self.token_status
        if self.token_status == 200:
            body = {
                "access_token": "google_access_token",
                "id_token": "google_id_token",
                "token_type": "Bearer",
                "expires_in": 3599,
            }
        else:
            body = {"error": self.token_error_code, "error_description": "Bad Request"}
        response._content = json.dumps(body).encode()
        response.headers["Content-Type"] = "application/json"
        response.url = url
        response.request = requests.Request(method, url).prepare()
        return response

    def verify_oauth2_token(self, token: str, *args: Any, **kwargs: Any) -> dict:
        if self.verify_error:
            raise self.verify_error
        return self.claims


@pytest.fixture
def google(monkeypatch: Any) -> FakeGoogle:
    fake = FakeGoogle()
    # requests-oauthlib sends the token request through requests.Session.request.
    monkeypatch.setattr(
        requests.Session,
        "request",
        lambda session, method, url, **kwargs: fake.request(method, url, **kwargs),
    )
    monkeypatch.setattr(
        "main.account.views.id_token.verify_oauth2_token", fake.verify_oauth2_token
    )
    return fake


def _start_authorization(redirect_uri: str) -> tuple[str, str]:
    """
    Start an authorization the way the frontend does, and return the state that
    Google will bring back and the cookie the browser keeps.
    """
    request = HttpRequest()
    request.method = "GET"
    request.GET = QueryDict(f"redirect_uri={redirect_uri}")
    response = get_authorization_url(request)
    authorization_url = json.loads(response.content)["authorization_url"]
    state = parse_qs(urlparse(authorization_url).query)["state"][0]
    return state, response.cookies[OAUTH_COOKIE_NAME].value


def _make_callback_request(
    redirect_uri: str,
    state: str | None,
    oauth_cookie: str | None,
    code: str = "google_code",
) -> HttpRequest:
    request = HttpRequest()
    request.method = "POST"
    request.POST = {"code": code, "redirect_uri": redirect_uri}
    if state is not None:
        request.POST["state"] = state
    if oauth_cookie is not None:
        request.COOKIES = {OAUTH_COOKIE_NAME: oauth_cookie}
    return request


def _is_oauth_cookie_deleted(response: HttpResponse) -> bool:
    return (
        OAUTH_COOKIE_NAME in response.cookies
        and response.cookies[OAUTH_COOKIE_NAME]["max-age"] == 0
    )


@pytest.mark.django_db
class TestGetAuthorizationUrlView:
    def test_get_authorization_url_stores_state_and_code_verifier_in_cookie(
        self,
    ) -> None:
        request = HttpRequest()
        request.method = "GET"
        request.GET = QueryDict(f"redirect_uri={LOGIN_REDIRECT_URI}")

        response = get_authorization_url(request)

        assert response.status_code == 200
        query = parse_qs(
            urlparse(json.loads(response.content)["authorization_url"]).query
        )
        cookie = response.cookies[OAUTH_COOKIE_NAME]
        assert cookie["httponly"]
        assert cookie["secure"]
        assert cookie["samesite"] == "Strict"
        assert cookie["path"] == OAUTH_COOKIE_PATH
        assert cookie["max-age"] == OAUTH_COOKIE_MAX_AGE
        authorization = signing.loads(cookie.value, salt=OAUTH_COOKIE_SALT)
        assert query["state"] == [authorization["state"]]
        code_challenge = (
            urlsafe_b64encode(
                hashlib.sha256(authorization["code_verifier"].encode()).digest()
            )
            .decode()
            .rstrip("=")
        )
        assert query["code_challenge"] == [code_challenge]
        assert query["code_challenge_method"] == ["S256"]

    def test_get_authorization_url_makes_new_state_each_time(self) -> None:
        first_state, _ = _start_authorization(LOGIN_REDIRECT_URI)
        second_state, _ = _start_authorization(LOGIN_REDIRECT_URI)

        assert first_state != second_state

    def test_get_authorization_url_missing_redirect_uri(self) -> None:
        request = HttpRequest()
        request.method = "GET"
        request.GET = QueryDict("")

        response = get_authorization_url(request)

        assert response.status_code == 400
        data = json.loads(response.content)
        assert data["message"] == "redirect_uri is required"


@pytest.mark.django_db
class TestGoogleLoginView:
    def test_google_login_success_new_user(self, google: FakeGoogle) -> None:
        state, oauth_cookie = _start_authorization(LOGIN_REDIRECT_URI)

        response = google_login(
            _make_callback_request(LOGIN_REDIRECT_URI, state, oauth_cookie)
        )

        assert response.status_code == 200
        assert ACCESS_COOKIE_NAME in response.cookies
        assert User.objects.filter(oauth_id="google_oauth_id").exists()
        assert _is_oauth_cookie_deleted(response)

    def test_google_login_sends_code_verifier_to_google(
        self, google: FakeGoogle
    ) -> None:
        """
        Without the code verifier kept in this browser's cookie, a leaked code
        cannot be exchanged for a token from another browser.
        """
        state, oauth_cookie = _start_authorization(LOGIN_REDIRECT_URI)
        code_verifier = signing.loads(oauth_cookie, salt=OAUTH_COOKIE_SALT)[
            "code_verifier"
        ]

        google_login(_make_callback_request(LOGIN_REDIRECT_URI, state, oauth_cookie))

        assert len(google.token_requests) == 1
        assert google.token_requests[0]["code"] == "google_code"
        assert google.token_requests[0]["code_verifier"] == code_verifier

    def test_google_login_success_existing_user(self, google: FakeGoogle) -> None:
        User.objects.create_user(
            oauth_org=OAuthOrganization.GOOGLE,
            oauth_id="google_oauth_id",
            email="test@example.com",
            username="Test User",
        )
        state, oauth_cookie = _start_authorization(LOGIN_REDIRECT_URI)

        response = google_login(
            _make_callback_request(LOGIN_REDIRECT_URI, state, oauth_cookie)
        )

        assert response.status_code == 200
        assert ACCESS_COOKIE_NAME in response.cookies
        assert User.objects.filter(oauth_id="google_oauth_id").count() == 1

    def test_google_login_insufficient_data(self) -> None:
        request = HttpRequest()
        request.method = "POST"
        request.POST = {"code": "auth_code"}  # Missing redirect_uri

        response = google_login(request)

        assert response.status_code == 400
        data = json.loads(response.content)
        assert data["message"] == "Data Not Sufficient"

    def test_google_login_missing_code(self) -> None:
        request = HttpRequest()
        request.method = "POST"
        request.POST = {"redirect_uri": LOGIN_REDIRECT_URI}

        response = google_login(request)

        assert response.status_code == 400
        data = json.loads(response.content)
        assert data["message"] == "Data Not Sufficient"

    @pytest.mark.scenario("ACCT-R12.1")
    def test_google_login_rejects_authorization_started_in_another_browser(
        self, google: FakeGoogle
    ) -> None:
        state, _ = _start_authorization(LOGIN_REDIRECT_URI)

        response = google_login(
            _make_callback_request(LOGIN_REDIRECT_URI, state, oauth_cookie=None)
        )

        assert response.status_code == 400
        assert json.loads(response.content)["message"] == GOOGLE_LOGIN_FAILED_MESSAGE
        assert ACCESS_COOKIE_NAME not in response.cookies
        assert google.token_requests == []

    def test_google_login_rejects_request_without_state(
        self, google: FakeGoogle
    ) -> None:
        """A link someone else sends can leave out `state`."""
        _, oauth_cookie = _start_authorization(LOGIN_REDIRECT_URI)

        response = google_login(
            _make_callback_request(LOGIN_REDIRECT_URI, None, oauth_cookie)
        )

        assert response.status_code == 400
        assert json.loads(response.content)["message"] == GOOGLE_LOGIN_FAILED_MESSAGE
        assert google.token_requests == []

    def test_google_login_rejects_forged_cookie(self, google: FakeGoogle) -> None:
        """The cookie must come from api-server, not from whoever sends the link."""
        forged_cookie = signing.dumps(
            {"state": "forged_state", "code_verifier": "forged_verifier"},
            key="not-the-secret-key",
            salt=OAUTH_COOKIE_SALT,
        )

        response = google_login(
            _make_callback_request(LOGIN_REDIRECT_URI, "forged_state", forged_cookie)
        )

        assert response.status_code == 400
        assert google.token_requests == []

    @pytest.mark.scenario("ACCT-R12.3")
    def test_google_login_rejects_authorization_older_than_10_minutes(
        self, google: FakeGoogle
    ) -> None:
        started_at = datetime.now().timestamp() - OAUTH_COOKIE_MAX_AGE - 1
        with patch("django.core.signing.time.time", return_value=started_at):
            state, oauth_cookie = _start_authorization(LOGIN_REDIRECT_URI)

        response = google_login(
            _make_callback_request(LOGIN_REDIRECT_URI, state, oauth_cookie)
        )

        assert response.status_code == 400
        assert json.loads(response.content)["message"] == GOOGLE_LOGIN_FAILED_MESSAGE
        assert ACCESS_COOKIE_NAME not in response.cookies

    def test_google_login_accepts_authorization_just_under_10_minutes(
        self, google: FakeGoogle
    ) -> None:
        started_at = datetime.now().timestamp() - OAUTH_COOKIE_MAX_AGE + 5
        with patch("django.core.signing.time.time", return_value=started_at):
            state, oauth_cookie = _start_authorization(LOGIN_REDIRECT_URI)

        response = google_login(
            _make_callback_request(LOGIN_REDIRECT_URI, state, oauth_cookie)
        )

        assert response.status_code == 200
        assert ACCESS_COOKIE_NAME in response.cookies

    @pytest.mark.scenario("ACCT-R12.4")
    def test_google_login_accepts_only_latest_authorization(
        self, google: FakeGoogle
    ) -> None:
        tab_a_state, _ = _start_authorization(LOGIN_REDIRECT_URI)
        # Tab B's cookie replaces tab A's in the same browser.
        tab_b_state, oauth_cookie = _start_authorization(LOGIN_REDIRECT_URI)

        tab_a_response = google_login(
            _make_callback_request(LOGIN_REDIRECT_URI, tab_a_state, oauth_cookie)
        )
        tab_b_response = google_login(
            _make_callback_request(LOGIN_REDIRECT_URI, tab_b_state, oauth_cookie)
        )

        assert tab_a_response.status_code == 400
        assert (
            json.loads(tab_a_response.content)["message"] == GOOGLE_LOGIN_FAILED_MESSAGE
        )
        assert ACCESS_COOKIE_NAME not in tab_a_response.cookies
        assert OAUTH_COOKIE_NAME not in tab_a_response.cookies
        assert tab_b_response.status_code == 200
        assert ACCESS_COOKIE_NAME in tab_b_response.cookies

    @pytest.mark.scenario("ACCT-R13.1")
    def test_google_login_when_google_rejects_code(self, google: FakeGoogle) -> None:
        google.token_status = 400
        state, oauth_cookie = _start_authorization(LOGIN_REDIRECT_URI)

        response = google_login(
            _make_callback_request(
                LOGIN_REDIRECT_URI, state, oauth_cookie, code="modified_code"
            )
        )

        assert response.status_code == 400
        assert json.loads(response.content)["message"] == GOOGLE_LOGIN_FAILED_MESSAGE
        assert ACCESS_COOKIE_NAME not in response.cookies
        # The callback URL counts as processed even though its code was modified.
        assert _is_oauth_cookie_deleted(response)

    @pytest.mark.scenario("ACCT-R13.3")
    @pytest.mark.parametrize(
        "error_setup",
        [
            {"token_error": requests.ConnectionError("Connection refused")},
            {"token_error": requests.Timeout("Read timed out")},
            {"token_status": 503},
            {"verify_error": google_auth_exceptions.TransportError("No certs")},
        ],
        ids=["connection-error", "timeout", "server-error", "certs-unreachable"],
    )
    def test_google_login_when_google_is_unreachable(
        self, google: FakeGoogle, error_setup: dict[str, Any]
    ) -> None:
        for name, value in error_setup.items():
            setattr(google, name, value)
        state, oauth_cookie = _start_authorization(LOGIN_REDIRECT_URI)

        response = google_login(
            _make_callback_request(LOGIN_REDIRECT_URI, state, oauth_cookie)
        )

        assert response.status_code == 502
        assert json.loads(response.content)["message"] == GOOGLE_LOGIN_FAILED_MESSAGE
        assert ACCESS_COOKIE_NAME not in response.cookies
        assert _is_oauth_cookie_deleted(response)

    @pytest.mark.parametrize(
        "verify_error",
        [
            ValueError("Token used too late"),
            google_auth_exceptions.GoogleAuthError("Wrong issuer"),
        ],
        ids=["invalid-token", "wrong-issuer"],
    )
    def test_google_login_when_id_token_cannot_be_verified(
        self, google: FakeGoogle, verify_error: Exception
    ) -> None:
        google.verify_error = verify_error
        state, oauth_cookie = _start_authorization(LOGIN_REDIRECT_URI)

        response = google_login(
            _make_callback_request(LOGIN_REDIRECT_URI, state, oauth_cookie)
        )

        assert response.status_code == 400
        assert json.loads(response.content)["message"] == GOOGLE_LOGIN_FAILED_MESSAGE
        assert ACCESS_COOKIE_NAME not in response.cookies

    def test_google_login_raises_when_client_is_misconfigured(
        self, google: FakeGoogle
    ) -> None:
        """
        A wrong client secret breaks every login, so it must surface as a server
        error instead of a message asking the user to log in again.
        """
        google.token_status = 401
        google.token_error_code = "invalid_client"
        state, oauth_cookie = _start_authorization(LOGIN_REDIRECT_URI)

        with pytest.raises(Exception, match="invalid_client"):
            google_login(
                _make_callback_request(LOGIN_REDIRECT_URI, state, oauth_cookie)
            )


@pytest.mark.django_db
class TestChangeGoogleBindingView:
    @pytest.fixture
    def user(self) -> User:
        return User.objects.create_user(
            oauth_org=OAuthOrganization.GOOGLE,
            oauth_id="original_oauth_id",
            email="test@example.com",
            username="Test User",
        )

    def _make_request(
        self,
        user: User,
        state: str | None,
        oauth_cookie: str | None,
        code: str = "google_code",
    ) -> HttpRequest:
        request = _make_callback_request(
            BINDING_REDIRECT_URI, state, oauth_cookie, code=code
        )
        request.user = user
        return request

    def _assert_binding_unchanged(self, user: User) -> None:
        user.refresh_from_db()
        assert user.oauth_id == "original_oauth_id"
        assert user.email == "test@example.com"

    @pytest.mark.scenario("ACCT-R11.1")
    def test_change_google_binding_success(
        self, google: FakeGoogle, user: User
    ) -> None:
        state, oauth_cookie = _start_authorization(BINDING_REDIRECT_URI)

        response = change_google_binding(self._make_request(user, state, oauth_cookie))

        assert response.status_code == 200
        data = json.loads(response.content)
        assert data["id"] == str(user.id)
        assert data["email"] == "google@example.com"
        assert data["username"] == "Google User"
        assert data["avatar_url"] == "https://example.com/google_avatar.jpg"
        assert data["subscription"] == {
            "plan": "standard",
            "market_refresh_interval_seconds": 30,
        }
        assert ACCESS_COOKIE_NAME in response.cookies
        assert _is_oauth_cookie_deleted(response)
        user.refresh_from_db()
        assert user.oauth_id == "google_oauth_id"

    @pytest.mark.scenario("ACCT-R11.2")
    def test_change_google_binding_already_bound(
        self, google: FakeGoogle, user: User
    ) -> None:
        User.objects.create_user(
            oauth_org=OAuthOrganization.GOOGLE,
            oauth_id="google_oauth_id",
            email="existing@example.com",
            username="Existing User",
        )
        state, oauth_cookie = _start_authorization(BINDING_REDIRECT_URI)

        response = change_google_binding(self._make_request(user, state, oauth_cookie))

        assert response.status_code == 400
        data = json.loads(response.content)
        assert (
            data["message"]
            == "This Google account is already bound to another account."
        )
        self._assert_binding_unchanged(user)

    @pytest.mark.scenario("BILL-R25.3")
    def test_change_google_binding_keeps_user_on_standard_whitelist(
        self, google: FakeGoogle, user: User
    ) -> None:
        BillingProfile.objects.create(
            user=user,
            plan=Plan.FREE,
            subscription_status=SubscriptionStatus.CANCELED,
            trial_started_at=timezone.now() - timedelta(days=40),
            trial_ends_at=timezone.now() - timedelta(days=9),
        )
        StandardWhitelist.objects.create(user=user)
        state, oauth_cookie = _start_authorization(BINDING_REDIRECT_URI)

        response = change_google_binding(self._make_request(user, state, oauth_cookie))

        assert response.status_code == 200
        assert json.loads(response.content)["subscription"]["plan"] == "standard"
        assert StandardWhitelist.objects.filter(user=user).exists()

    def test_change_google_binding_insufficient_data(self, user: User) -> None:
        request = HttpRequest()
        request.user = user
        request.method = "POST"
        request.POST = {"code": "auth_code"}  # Missing redirect_uri

        response = change_google_binding(request)

        assert response.status_code == 400
        data = json.loads(response.content)
        assert data["message"] == "Data Not Sufficient"

    @pytest.mark.scenario("ACCT-R12.2")
    def test_change_google_binding_rejects_authorization_started_in_another_browser(
        self, google: FakeGoogle, user: User
    ) -> None:
        state, _ = _start_authorization(BINDING_REDIRECT_URI)

        response = change_google_binding(
            self._make_request(user, state, oauth_cookie=None)
        )

        assert response.status_code == 400
        assert json.loads(response.content)["message"] == GOOGLE_BINDING_FAILED_MESSAGE
        assert ACCESS_COOKIE_NAME not in response.cookies
        assert google.token_requests == []
        self._assert_binding_unchanged(user)

    @pytest.mark.scenario("ACCT-R13.2")
    def test_change_google_binding_when_google_rejects_code(
        self, google: FakeGoogle, user: User
    ) -> None:
        google.token_status = 400
        state, oauth_cookie = _start_authorization(BINDING_REDIRECT_URI)

        response = change_google_binding(
            self._make_request(user, state, oauth_cookie, code="modified_code")
        )

        assert response.status_code == 400
        assert json.loads(response.content)["message"] == GOOGLE_BINDING_FAILED_MESSAGE
        assert _is_oauth_cookie_deleted(response)
        self._assert_binding_unchanged(user)

    @pytest.mark.scenario("ACCT-R13.5")
    def test_change_google_binding_checks_state_before_already_bound(
        self, google: FakeGoogle, user: User
    ) -> None:
        google.claims["sub"] = user.oauth_id
        tab_a_state, _ = _start_authorization(BINDING_REDIRECT_URI)
        _, oauth_cookie = _start_authorization(BINDING_REDIRECT_URI)

        response = change_google_binding(
            self._make_request(user, tab_a_state, oauth_cookie)
        )

        assert response.status_code == 400
        assert json.loads(response.content)["message"] == GOOGLE_BINDING_FAILED_MESSAGE
        self._assert_binding_unchanged(user)

    @pytest.mark.scenario("ACCT-R12.6")
    def test_change_google_binding_after_access_token_expired(
        self, google: FakeGoogle, user: User
    ) -> None:
        browser = Client()
        browser.cookies[REFRESH_COOKIE_NAME] = issue_token_pair(user).refresh_token
        browser.cookies[ACCESS_COOKIE_NAME] = jwt.encode(
            {"id": str(user.id), "exp": int(datetime.now().timestamp()) - 60},
            settings.SECRET_KEY,
            algorithm=settings.JWT_ALGORITHM,
        )
        response = browser.get(
            "/api/account/authorization-url", {"redirect_uri": BINDING_REDIRECT_URI}
        )
        state = parse_qs(
            urlparse(json.loads(response.content)["authorization_url"]).query
        )["state"][0]
        callback_data = {
            "code": "google_code",
            "state": state,
            "redirect_uri": BINDING_REDIRECT_URI,
        }
        # Someone else's request without login, right before the user comes back.
        Client().post("/api/account/change-binding", callback_data)

        expired_response = browser.post("/api/account/change-binding", callback_data)
        browser.post("/api/account/refresh-token")
        retried_response = browser.post("/api/account/change-binding", callback_data)

        assert expired_response.status_code == 401
        assert OAUTH_COOKIE_NAME not in expired_response.cookies
        assert retried_response.status_code == 200
        assert json.loads(retried_response.content)["email"] == "google@example.com"
        user.refresh_from_db()
        assert user.oauth_id == "google_oauth_id"


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

    @pytest.mark.scenario("MKT-R11.1")
    def test_me_success(self, request_obj: HttpRequest) -> None:
        request_obj.method = "GET"
        response = me(request_obj)

        assert response.status_code == 200
        data = json.loads(response.content)
        assert data["id"] == str(request_obj.user.id)
        assert data["username"] == "Test User"
        assert data["email"] == "test@example.com"
        assert data["avatar_url"] == "https://example.com/avatar.jpg"
        assert data["subscription"] == {
            "plan": "standard",
            "market_refresh_interval_seconds": 30,
        }

    @pytest.mark.scenario("ACCT-R9.3")
    def test_me_without_avatar(self, request_obj: HttpRequest, user: User) -> None:
        user.avatar_url = None
        user.save()

        request_obj.method = "GET"
        response = me(request_obj)

        assert response.status_code == 200
        data = json.loads(response.content)
        assert data["avatar_url"] is None


@pytest.mark.django_db
class TestOpenSessionView:
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
        request.method = "POST"
        return request

    def test_open_session_sets_last_login_when_empty(
        self, request_obj: HttpRequest, user: User
    ) -> None:
        response = open_session(request_obj)

        assert response.status_code == 200
        user.refresh_from_db()
        assert user.last_login is not None

    def test_open_session_updates_old_last_login(
        self, request_obj: HttpRequest, user: User
    ) -> None:
        old_last_login = timezone.now() - timedelta(minutes=16)
        user.last_login = old_last_login
        user.save()

        response = open_session(request_obj)

        assert response.status_code == 200
        user.refresh_from_db()
        assert user.last_login is not None
        assert user.last_login > old_last_login

    def test_open_session_keeps_recent_last_login(
        self, request_obj: HttpRequest, user: User
    ) -> None:
        recent_last_login = timezone.now() - timedelta(minutes=4)
        user.last_login = recent_last_login
        user.save()

        response = open_session(request_obj)

        assert response.status_code == 200
        user.refresh_from_db()
        assert user.last_login == recent_last_login

    def _open_session_at(
        self,
        request: HttpRequest,
        monkeypatch: pytest.MonkeyPatch,
        now: datetime,
        platform: str | None,
    ) -> HttpResponse:
        monkeypatch.setattr("main.account.views.timezone.now", lambda: now)
        request.POST = QueryDict("" if platform is None else f"platform={platform}")
        return open_session(request)

    def _get_activities(self, user: User) -> list[tuple[date, str | None]]:
        return list(
            DailyActivity.objects.filter(user=user)
            .order_by("date", "platform")
            .values_list("date", "platform")
        )

    @pytest.mark.scenario("USAGE-R1.1")
    def test_open_session_records_web_usage(
        self, request_obj: HttpRequest, user: User, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        response = self._open_session_at(
            request_obj, monkeypatch, datetime(2026, 10, 24, 9, 0, tzinfo=TAIPEI), "web"
        )

        assert response.status_code == 200
        assert self._get_activities(user) == [(date(2026, 10, 24), "web")]

    @pytest.mark.scenario("USAGE-R1.2")
    def test_open_session_records_pwa_usage(
        self, request_obj: HttpRequest, user: User, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        response = self._open_session_at(
            request_obj, monkeypatch, datetime(2026, 10, 24, 9, 0, tzinfo=TAIPEI), "pwa"
        )

        assert response.status_code == 200
        assert self._get_activities(user) == [(date(2026, 10, 24), "pwa")]

    @pytest.mark.scenario("USAGE-R1.5")
    def test_open_session_twice_on_one_day_keeps_one_record(
        self, request_obj: HttpRequest, user: User, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        self._open_session_at(
            request_obj, monkeypatch, datetime(2026, 10, 24, 9, 0, tzinfo=TAIPEI), "web"
        )
        response = self._open_session_at(
            request_obj,
            monkeypatch,
            datetime(2026, 10, 24, 21, 0, tzinfo=TAIPEI),
            "web",
        )

        assert response.status_code == 200
        assert self._get_activities(user) == [(date(2026, 10, 24), "web")]

    @pytest.mark.scenario("USAGE-R1.6")
    def test_open_session_on_two_platforms_keeps_one_record_each(
        self, request_obj: HttpRequest, user: User, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        self._open_session_at(
            request_obj, monkeypatch, datetime(2026, 10, 24, 9, 0, tzinfo=TAIPEI), "web"
        )
        response = self._open_session_at(
            request_obj,
            monkeypatch,
            datetime(2026, 10, 24, 21, 0, tzinfo=TAIPEI),
            "pwa",
        )

        assert response.status_code == 200
        assert self._get_activities(user) == [
            (date(2026, 10, 24), "pwa"),
            (date(2026, 10, 24), "web"),
        ]

    @pytest.mark.scenario("USAGE-R1.7", "USAGE-R1.8")
    def test_open_session_after_midnight_records_the_new_day(
        self, request_obj: HttpRequest, user: User, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        self._open_session_at(
            request_obj,
            monkeypatch,
            datetime(2026, 10, 24, 23, 50, tzinfo=TAIPEI),
            "web",
        )
        response = self._open_session_at(
            request_obj,
            monkeypatch,
            datetime(2026, 10, 25, 0, 10, tzinfo=TAIPEI),
            "web",
        )

        assert response.status_code == 200
        assert self._get_activities(user) == [
            (date(2026, 10, 24), "web"),
            (date(2026, 10, 25), "web"),
        ]

    @pytest.mark.scenario("USAGE-R1.9")
    def test_open_session_uses_taiwan_date(
        self, request_obj: HttpRequest, user: User, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        response = self._open_session_at(
            request_obj, monkeypatch, datetime(2026, 10, 24, 23, 30, tzinfo=UTC), "web"
        )

        assert response.status_code == 200
        assert self._get_activities(user) == [(date(2026, 10, 25), "web")]

    def test_open_session_without_platform_records_one_row_per_day(
        self, request_obj: HttpRequest, user: User, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """
        Frontends released before platforms were recorded send no platform, and
        their visits still count a user once per day.
        """
        self._open_session_at(
            request_obj, monkeypatch, datetime(2026, 10, 24, 9, 0, tzinfo=TAIPEI), None
        )
        response = self._open_session_at(
            request_obj, monkeypatch, datetime(2026, 10, 24, 21, 0, tzinfo=TAIPEI), None
        )

        assert response.status_code == 200
        assert self._get_activities(user) == [(date(2026, 10, 24), None)]

    @pytest.mark.parametrize("platform", ["ios", ""])
    def test_open_session_rejects_unknown_platform(
        self,
        request_obj: HttpRequest,
        user: User,
        monkeypatch: pytest.MonkeyPatch,
        platform: str,
    ) -> None:
        response = self._open_session_at(
            request_obj,
            monkeypatch,
            datetime(2026, 10, 24, 9, 0, tzinfo=TAIPEI),
            platform,
        )

        assert response.status_code == 400
        assert self._get_activities(user) == []


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
        request_obj.method = "POST"
        response = logout(request_obj)

        assert response.status_code == 200
        # Check that cookie is deleted
        assert response.cookies[ACCESS_COOKIE_NAME].value == ""


@pytest.mark.django_db
class TestRefreshView:
    @pytest.fixture
    def user(self) -> User:
        return User.objects.create_user(
            oauth_org=OAuthOrganization.GOOGLE,
            oauth_id="test_oauth_id",
            email="test@example.com",
            username="Test User",
        )

    @pytest.mark.scenario("ACCT-R5.1")
    def test_refresh_rotates_browser_tokens(self, user: User) -> None:
        request = HttpRequest()
        request.method = "POST"
        request.COOKIES = {REFRESH_COOKIE_NAME: issue_token_pair(user).refresh_token}

        response = refresh_token(request)

        assert response.status_code == 200
        assert ACCESS_COOKIE_NAME in response.cookies
        assert REFRESH_COOKIE_NAME in response.cookies

    def test_refresh_accepts_legacy_refresh_cookie(self, user: User) -> None:
        request = HttpRequest()
        request.method = "POST"
        request.COOKIES = {
            LEGACY_REFRESH_COOKIE_NAME: issue_token_pair(user).refresh_token
        }

        response = refresh_token(request)

        assert response.status_code == 200
        assert ACCESS_COOKIE_NAME in response.cookies
        assert REFRESH_COOKIE_NAME in response.cookies
        # The legacy cookie must be expired in the same response.
        assert response.cookies[LEGACY_REFRESH_COOKIE_NAME].value == ""
        assert response.cookies[LEGACY_REFRESH_COOKIE_NAME]["max-age"] == 0

    def test_refresh_rejects_missing_refresh_token(self) -> None:
        request = HttpRequest()
        request.method = "POST"
        request.COOKIES = {}

        response = refresh_token(request)

        assert response.status_code == 401
        assert response.cookies[ACCESS_COOKIE_NAME].value == ""
        assert response.cookies[REFRESH_COOKIE_NAME].value == ""


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

    @pytest.mark.scenario("ACCT-R9.1")
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
        assert data["subscription"] == {
            "plan": "standard",
            "market_refresh_interval_seconds": 30,
        }

        # Verify user was updated in database
        user.refresh_from_db()
        assert user.username == "New Username"

    @pytest.mark.scenario("ACCT-R9.2")
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

    @pytest.mark.scenario("ACCT-R9.3")
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
