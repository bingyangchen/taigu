from django.core import signing
from django.http import HttpRequest, HttpResponse
from django.utils.crypto import constant_time_compare

from main.account import ACCESS_COOKIE_NAME, OAUTH_COOKIE_NAME, REFRESH_COOKIE_NAME
from main.account.tokens import ACCESS_TOKEN_MAX_AGE, REFRESH_TOKEN_MAX_AGE
from main.env import Env, env
from main.origins import get_public_frontend_host

AUTH_COOKIE_HANDLED_ATTRIBUTE = "_auth_cookie_handled"
REFRESH_COOKIE_PATH = "/api/account"
OAUTH_COOKIE_PATH = "/api/account"
OAUTH_COOKIE_MAX_AGE = 10 * 60
OAUTH_COOKIE_SALT = "main.account.cookies.oauth"

# TODO: Cookies issued before 2026-07 used these names, scoped to the registrable domain
# in prod. Every authenticated response now expires them so stale copies leave the
# browser on the first request instead of lingering. Remove these constants, the
# read fallbacks, and the _delete_legacy_* helpers once all legacy refresh cookies
# have expired, i.e. REFRESH_TOKEN_MAX_AGE after this change reaches prod.
LEGACY_ACCESS_COOKIE_NAME = "access_token"
LEGACY_REFRESH_COOKIE_NAME = "refresh_token"


def has_auth_cookie_been_handled(response: HttpResponse) -> bool:
    return bool(getattr(response, AUTH_COOKIE_HANDLED_ATTRIBUTE, False))


def _mark_auth_cookie_as_handled(response: HttpResponse) -> None:
    setattr(response, AUTH_COOKIE_HANDLED_ATTRIBUTE, True)


def _legacy_cookie_domain() -> str | None:
    return get_public_frontend_host() if env.ENV == Env.PROD else None


def _delete_legacy_access_cookie(response: HttpResponse) -> None:
    response.delete_cookie(LEGACY_ACCESS_COOKIE_NAME, domain=_legacy_cookie_domain())


def _delete_legacy_refresh_cookie(response: HttpResponse) -> None:
    response.delete_cookie(
        LEGACY_REFRESH_COOKIE_NAME,
        path=REFRESH_COOKIE_PATH,
        domain=_legacy_cookie_domain(),
    )


def get_access_token(request: HttpRequest) -> str:
    return request.COOKIES.get(ACCESS_COOKIE_NAME) or request.COOKIES.get(
        LEGACY_ACCESS_COOKIE_NAME, ""
    )


def get_refresh_token(request: HttpRequest) -> str:
    return request.COOKIES.get(REFRESH_COOKIE_NAME) or request.COOKIES.get(
        LEGACY_REFRESH_COOKIE_NAME, ""
    )


def set_access_cookie(response: HttpResponse, access_token: str) -> HttpResponse:
    response.set_cookie(
        key=ACCESS_COOKIE_NAME,
        value=access_token,
        max_age=ACCESS_TOKEN_MAX_AGE,
        secure=True,
        httponly=True,
        samesite="Strict",
    )
    _delete_legacy_access_cookie(response)
    _mark_auth_cookie_as_handled(response)
    return response


def set_refresh_cookie(response: HttpResponse, refresh_token: str) -> HttpResponse:
    response.set_cookie(
        key=REFRESH_COOKIE_NAME,
        value=refresh_token,
        max_age=REFRESH_TOKEN_MAX_AGE,
        secure=True,
        httponly=True,
        path=REFRESH_COOKIE_PATH,
        samesite="Strict",
    )
    _delete_legacy_refresh_cookie(response)
    _mark_auth_cookie_as_handled(response)
    return response


def set_auth_cookies(
    response: HttpResponse, access_token: str, refresh_token: str
) -> HttpResponse:
    response = set_access_cookie(response, access_token)
    return set_refresh_cookie(response, refresh_token)


def delete_access_cookie(response: HttpResponse) -> HttpResponse:
    response.delete_cookie(ACCESS_COOKIE_NAME)
    _delete_legacy_access_cookie(response)
    _mark_auth_cookie_as_handled(response)
    return response


def delete_refresh_cookie(response: HttpResponse) -> HttpResponse:
    response.delete_cookie(REFRESH_COOKIE_NAME, path=REFRESH_COOKIE_PATH)
    _delete_legacy_refresh_cookie(response)
    _mark_auth_cookie_as_handled(response)
    return response


def delete_auth_cookies(response: HttpResponse) -> HttpResponse:
    response = delete_access_cookie(response)
    return delete_refresh_cookie(response)


def set_oauth_cookie(
    response: HttpResponse, state: str, code_verifier: str
) -> HttpResponse:
    response.set_cookie(
        key=OAUTH_COOKIE_NAME,
        value=signing.dumps(
            {"state": state, "code_verifier": code_verifier}, salt=OAUTH_COOKIE_SALT
        ),
        max_age=OAUTH_COOKIE_MAX_AGE,
        secure=True,
        httponly=True,
        path=OAUTH_COOKIE_PATH,
        samesite="Strict",
    )
    return response


def get_oauth_code_verifier(request: HttpRequest, state: str) -> str | None:
    """
    None means the authorization must be rejected: the cookie is missing, not signed
    by api-server, older than OAUTH_COOKIE_MAX_AGE, or `state` does not match.
    """
    try:
        authorization = signing.loads(
            request.COOKIES.get(OAUTH_COOKIE_NAME, ""),
            salt=OAUTH_COOKIE_SALT,
            max_age=OAUTH_COOKIE_MAX_AGE,
        )
    except signing.BadSignature:
        return None
    if not state or not constant_time_compare(state, authorization["state"]):
        return None
    return authorization["code_verifier"]


def delete_oauth_cookie(response: HttpResponse) -> HttpResponse:
    response.delete_cookie(OAUTH_COOKIE_NAME, path=OAUTH_COOKIE_PATH)
    return response
