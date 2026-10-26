import hashlib
from datetime import timedelta
from urllib.parse import parse_qs, urlparse

import pytest
from django.test import Client
from django.utils import timezone

from main.account import (
    ACCESS_COOKIE_NAME,
    OAUTH_COOKIE_NAME,
    REFRESH_COOKIE_NAME,
    OAuthOrganization,
)
from main.account.models import RefreshToken, User
from main.account.services.tokens import issue_token_pair
from main.account.tests.unit.test_views import FakeGoogle, google  # noqa: F401

ORIGIN = "https://local.taigu.tw"


@pytest.fixture
def user() -> User:
    return User.objects.create_user(
        oauth_org=OAuthOrganization.GOOGLE,
        oauth_id="csrf-user",
        email="csrf@example.com",
        username="Original",
    )


def _make_browser(user: User) -> Client:
    browser = Client(enforce_csrf_checks=True)
    pair = issue_token_pair(user)
    browser.cookies[ACCESS_COOKIE_NAME] = pair.access_token
    browser.cookies[REFRESH_COOKIE_NAME] = pair.refresh_token
    return browser


def _get_csrf(browser: Client) -> str:
    response = browser.get("/api/account/csrf-token", secure=True)
    assert response.status_code == 200
    assert "csrftoken" in response.cookies
    assert ACCESS_COOKIE_NAME not in response.cookies
    assert REFRESH_COOKIE_NAME not in response.cookies
    return browser.cookies["csrftoken"].value


@pytest.mark.django_db
@pytest.mark.scenario("ACCT-R16.1", "ACCT-R16.2")
@pytest.mark.parametrize("failure", ["cookie_missing", "header_missing", "mismatch"])
def test_csrf_rejects_before_write_and_accepts_recovered_token(
    user: User, failure: str
) -> None:
    """A rejected write must have no effect before a single corrected retry."""
    browser = _make_browser(user)
    if failure != "cookie_missing":
        _get_csrf(browser)
    headers = {"HTTP_ORIGIN": ORIGIN}
    if failure == "mismatch":
        headers["HTTP_X_CSRFTOKEN"] = "A" * 32
    response = browser.post(
        "/api/account/update",
        {"username": "Changed"},
        content_type="application/json",
        secure=True,
        **headers,
    )
    assert response.status_code == 403
    assert response.json()["code"] == "CSRF_TOKEN_RECOVERABLE"
    user.refresh_from_db()
    assert user.username == "Original"
    csrf = _get_csrf(browser)
    recovered = browser.post(
        "/api/account/update",
        {"username": "Changed"},
        content_type="application/json",
        secure=True,
        HTTP_ORIGIN=ORIGIN,
        HTTP_X_CSRFTOKEN=csrf,
    )
    assert recovered.status_code == 200
    user.refresh_from_db()
    assert user.username == "Changed"
    assert browser.get("/api/account/me").status_code == 200


@pytest.mark.django_db
@pytest.mark.scenario("ACCT-R16.3", "ACCT-R16.9")
@pytest.mark.parametrize(
    "headers",
    [
        {"HTTP_ORIGIN": "https://attacker.example"},
        {"HTTP_REFERER": "https://attacker.example/"},
        {},
        {"HTTP_ORIGIN": ORIGIN, "HTTP_X_CSRFTOKEN": "invalid"},
        {"HTTP_ORIGIN": ORIGIN, "HTTP_X_CSRFTOKEN": "!" * 32},
    ],
)
def test_csrf_origin_and_malformed_tokens_are_not_recoverable(
    user: User, headers: dict[str, str]
) -> None:
    """Obtaining a new token cannot repair an untrusted origin or malformed token."""
    browser = _make_browser(user)
    _get_csrf(browser)
    response = browser.post(
        "/api/account/update",
        {"username": "Changed"},
        content_type="application/json",
        secure=True,
        **headers,
    )
    assert response.status_code == 403
    assert response.json()["code"] == "CSRF_FAILED"
    user.refresh_from_db()
    assert user.username == "Original"
    assert browser.get("/api/account/me").status_code == 200


@pytest.mark.django_db
@pytest.mark.scenario("ACCT-R16.6", "ACCT-R16.8")
@pytest.mark.parametrize("expired", [False, True])
def test_refresh_recovers_csrf_before_deciding_authentication(
    user: User, expired: bool
) -> None:
    """CSRF recovery must remain available when the access token has expired."""
    browser = _make_browser(user)
    del browser.cookies[ACCESS_COOKIE_NAME]
    if expired:
        RefreshToken.objects.update(expires_at=timezone.now() - timedelta(seconds=1))
    first = browser.post("/api/account/refresh-token", secure=True, HTTP_ORIGIN=ORIGIN)
    assert first.status_code == 403
    assert first.json()["code"] == "CSRF_TOKEN_RECOVERABLE"
    assert RefreshToken.objects.filter(revoked_at__isnull=True).count() == 1
    csrf = _get_csrf(browser)
    response = browser.post(
        "/api/account/refresh-token",
        secure=True,
        HTTP_ORIGIN=ORIGIN,
        HTTP_X_CSRFTOKEN=csrf,
    )
    assert response.status_code == (401 if expired else 200)
    if not expired:
        assert browser.get("/api/account/me").status_code == 200


@pytest.mark.django_db
@pytest.mark.scenario("ACCT-R7.1", "ACCT-R16.7")
def test_logout_recovers_csrf_and_revokes_the_family(user: User) -> None:
    """A CSRF rejection must leave the session usable until logout actually succeeds."""
    browser = _make_browser(user)
    raw = browser.cookies[REFRESH_COOKIE_NAME].value
    token_hash = hashlib.sha256(raw.encode()).hexdigest()
    rejected = browser.post("/api/account/logout", secure=True, HTTP_ORIGIN=ORIGIN)
    assert rejected.status_code == 403
    assert RefreshToken.objects.get(pk=token_hash).revoked_at is None
    csrf = _get_csrf(browser)
    response = browser.post(
        "/api/account/logout", secure=True, HTTP_ORIGIN=ORIGIN, HTTP_X_CSRFTOKEN=csrf
    )
    assert response.status_code == 200
    assert RefreshToken.objects.get(pk=token_hash).revoked_at is not None
    assert response.cookies[ACCESS_COOKIE_NAME]["max-age"] == 0
    assert response.cookies[REFRESH_COOKIE_NAME]["max-age"] == 0


@pytest.mark.django_db
@pytest.mark.scenario("ACCT-R16.10")
def test_login_csrf_rejection_does_not_consume_oauth(google: FakeGoogle) -> None:  # noqa: F811
    """The retry must be able to exchange the original authorization exactly once."""
    browser = Client(enforce_csrf_checks=True)
    started = browser.get(
        "/api/account/authorization-url", {"redirect_uri": f"{ORIGIN}/login"}
    )
    state = parse_qs(urlparse(started.json()["authorization_url"]).query)["state"][0]
    cookie = browser.cookies[OAUTH_COOKIE_NAME].value
    del browser.cookies["csrftoken"]
    data = {"code": "google_code", "state": state, "redirect_uri": f"{ORIGIN}/login"}
    rejected = browser.post(
        "/api/account/google-login", data, secure=True, HTTP_ORIGIN=ORIGIN
    )
    assert rejected.status_code == 403
    assert browser.cookies[OAUTH_COOKIE_NAME].value == cookie
    assert google.token_requests == []
    assert not User.objects.exists()
    csrf = _get_csrf(browser)
    response = browser.post(
        "/api/account/google-login",
        data,
        secure=True,
        HTTP_ORIGIN=ORIGIN,
        HTTP_X_CSRFTOKEN=csrf,
    )
    assert response.status_code == 200
    assert len(google.token_requests) == 1
    assert User.objects.count() == 1
