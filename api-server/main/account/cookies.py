from django.http import HttpResponse

from main.account import ACCESS_COOKIE_NAME, REFRESH_COOKIE_NAME
from main.account.tokens import ACCESS_TOKEN_MAX_AGE, REFRESH_TOKEN_MAX_AGE
from main.env import Env, env

PRODUCTION_DOMAIN = "taigu.tw"
AUTH_COOKIE_HANDLED_ATTRIBUTE = "_auth_cookie_handled"
REFRESH_COOKIE_PATH = "/api/account"


def has_auth_cookie_been_handled(response: HttpResponse) -> bool:
    return bool(getattr(response, AUTH_COOKIE_HANDLED_ATTRIBUTE, False))


def _mark_auth_cookie_as_handled(response: HttpResponse) -> None:
    setattr(response, AUTH_COOKIE_HANDLED_ATTRIBUTE, True)


def set_access_cookie(response: HttpResponse, access_token: str) -> HttpResponse:
    cookie_options = {
        "key": ACCESS_COOKIE_NAME,
        "value": access_token,
        "max_age": ACCESS_TOKEN_MAX_AGE,
        "secure": True,
        "httponly": True,
    }
    if env.ENV == Env.PROD:
        response.set_cookie(**cookie_options, domain=PRODUCTION_DOMAIN, samesite="Lax")
    else:
        response.set_cookie(**cookie_options, samesite="Strict")
    _mark_auth_cookie_as_handled(response)
    return response


def set_refresh_cookie(response: HttpResponse, refresh_token: str) -> HttpResponse:
    cookie_options = {
        "key": REFRESH_COOKIE_NAME,
        "value": refresh_token,
        "max_age": REFRESH_TOKEN_MAX_AGE,
        "secure": True,
        "httponly": True,
        "path": REFRESH_COOKIE_PATH,
    }
    if env.ENV == Env.PROD:
        response.set_cookie(**cookie_options, domain=PRODUCTION_DOMAIN, samesite="Lax")
    else:
        response.set_cookie(**cookie_options, samesite="Strict")
    _mark_auth_cookie_as_handled(response)
    return response


def set_auth_cookies(
    response: HttpResponse, access_token: str, refresh_token: str
) -> HttpResponse:
    response = set_access_cookie(response, access_token)
    return set_refresh_cookie(response, refresh_token)


def delete_access_cookie(response: HttpResponse) -> HttpResponse:
    if env.ENV == Env.PROD:
        response.delete_cookie(
            ACCESS_COOKIE_NAME, domain=PRODUCTION_DOMAIN, samesite="Lax"
        )
    else:
        response.delete_cookie(ACCESS_COOKIE_NAME)
    _mark_auth_cookie_as_handled(response)
    return response


def delete_refresh_cookie(response: HttpResponse) -> HttpResponse:
    if env.ENV == Env.PROD:
        response.delete_cookie(
            REFRESH_COOKIE_NAME,
            path=REFRESH_COOKIE_PATH,
            domain=PRODUCTION_DOMAIN,
            samesite="Lax",
        )
    else:
        response.delete_cookie(REFRESH_COOKIE_NAME, path=REFRESH_COOKIE_PATH)
    _mark_auth_cookie_as_handled(response)
    return response


def delete_auth_cookies(response: HttpResponse) -> HttpResponse:
    response = delete_access_cookie(response)
    return delete_refresh_cookie(response)
