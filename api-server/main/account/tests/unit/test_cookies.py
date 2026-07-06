# ruff: noqa: ANN401
from typing import Any

from django.http import HttpRequest, HttpResponse

from main.account import ACCESS_COOKIE_NAME, REFRESH_COOKIE_NAME
from main.account.cookies import (
    LEGACY_ACCESS_COOKIE_NAME,
    LEGACY_REFRESH_COOKIE_NAME,
    REFRESH_COOKIE_PATH,
    delete_auth_cookies,
    get_access_token,
    get_refresh_token,
    set_auth_cookies,
)
from main.env import Env, env


class TestSetAuthCookies:
    def test_cookies_are_host_only_strict_secure_and_httponly(self) -> None:
        response = set_auth_cookies(HttpResponse(), "access", "refresh")

        access = response.cookies[ACCESS_COOKIE_NAME]
        assert access.value == "access"
        assert access["secure"]
        assert access["httponly"]
        assert access["samesite"] == "Strict"
        assert access["domain"] == ""
        assert access["path"] == "/"

        refresh = response.cookies[REFRESH_COOKIE_NAME]
        assert refresh.value == "refresh"
        assert refresh["secure"]
        assert refresh["httponly"]
        assert refresh["samesite"] == "Strict"
        assert refresh["domain"] == ""
        assert refresh["path"] == REFRESH_COOKIE_PATH

    def test_setting_expires_legacy_cookies(self) -> None:
        response = set_auth_cookies(HttpResponse(), "access", "refresh")

        legacy_access = response.cookies[LEGACY_ACCESS_COOKIE_NAME]
        assert legacy_access.value == ""
        assert legacy_access["max-age"] == 0

        legacy_refresh = response.cookies[LEGACY_REFRESH_COOKIE_NAME]
        assert legacy_refresh.value == ""
        assert legacy_refresh["max-age"] == 0
        assert legacy_refresh["path"] == REFRESH_COOKIE_PATH

    def test_legacy_cleanup_targets_parent_domain_in_prod(
        self, monkeypatch: Any
    ) -> None:
        monkeypatch.setattr(env, "ENV", Env.PROD)

        response = set_auth_cookies(HttpResponse(), "access", "refresh")

        # New cookies stay host-only even in prod.
        assert response.cookies[ACCESS_COOKIE_NAME]["domain"] == ""
        assert response.cookies[REFRESH_COOKIE_NAME]["domain"] == ""
        # Legacy cookies were domain-scoped, so deletion must target that domain.
        assert response.cookies[LEGACY_ACCESS_COOKIE_NAME]["domain"] == "taigu.tw"
        assert response.cookies[LEGACY_REFRESH_COOKIE_NAME]["domain"] == "taigu.tw"


class TestDeleteAuthCookies:
    def test_expires_new_and_legacy_cookies(self) -> None:
        response = delete_auth_cookies(HttpResponse())

        for name in (
            ACCESS_COOKIE_NAME,
            LEGACY_ACCESS_COOKIE_NAME,
            REFRESH_COOKIE_NAME,
            LEGACY_REFRESH_COOKIE_NAME,
        ):
            assert response.cookies[name].value == ""
            assert response.cookies[name]["max-age"] == 0
        assert response.cookies[REFRESH_COOKIE_NAME]["path"] == REFRESH_COOKIE_PATH
        assert (
            response.cookies[LEGACY_REFRESH_COOKIE_NAME]["path"] == REFRESH_COOKIE_PATH
        )

    def test_deletion_targets_parent_domain_for_legacy_cookies_in_prod(
        self, monkeypatch: Any
    ) -> None:
        monkeypatch.setattr(env, "ENV", Env.PROD)

        response = delete_auth_cookies(HttpResponse())

        assert response.cookies[ACCESS_COOKIE_NAME]["domain"] == ""
        assert response.cookies[REFRESH_COOKIE_NAME]["domain"] == ""
        assert response.cookies[LEGACY_ACCESS_COOKIE_NAME]["domain"] == "taigu.tw"
        assert response.cookies[LEGACY_REFRESH_COOKIE_NAME]["domain"] == "taigu.tw"


class TestTokenGetters:
    def test_prefers_new_cookie_over_legacy(self) -> None:
        request = HttpRequest()
        request.COOKIES = {
            ACCESS_COOKIE_NAME: "new_access",
            LEGACY_ACCESS_COOKIE_NAME: "old_access",
            REFRESH_COOKIE_NAME: "new_refresh",
            LEGACY_REFRESH_COOKIE_NAME: "old_refresh",
        }

        assert get_access_token(request) == "new_access"
        assert get_refresh_token(request) == "new_refresh"

    def test_falls_back_to_legacy_cookie(self) -> None:
        request = HttpRequest()
        request.COOKIES = {
            LEGACY_ACCESS_COOKIE_NAME: "old_access",
            LEGACY_REFRESH_COOKIE_NAME: "old_refresh",
        }

        assert get_access_token(request) == "old_access"
        assert get_refresh_token(request) == "old_refresh"

    def test_defaults_to_empty_string(self) -> None:
        request = HttpRequest()
        request.COOKIES = {}

        assert get_access_token(request) == ""
        assert get_refresh_token(request) == ""
