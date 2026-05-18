from django.http import HttpResponse

from main.account import AUTH_COOKIE_NAME
from main.env import Env, env

JWT_COOKIE_MAX_AGE = 5 * 24 * 60 * 60  # 5 days
PRODUCTION_DOMAIN = "taigu.tw"
AUTH_COOKIE_HANDLED_ATTRIBUTE = "_auth_cookie_handled"


def has_auth_cookie_been_handled(response: HttpResponse) -> bool:
    return bool(getattr(response, AUTH_COOKIE_HANDLED_ATTRIBUTE, False))


def _mark_auth_cookie_as_handled(response: HttpResponse) -> None:
    setattr(response, AUTH_COOKIE_HANDLED_ATTRIBUTE, True)


def set_auth_cookie(response: HttpResponse, token: str) -> HttpResponse:
    if env.ENV == Env.PROD:
        response.set_cookie(
            key=AUTH_COOKIE_NAME,
            value=token,
            max_age=JWT_COOKIE_MAX_AGE,
            domain=PRODUCTION_DOMAIN,
            secure=True,
            httponly=True,
            samesite="Lax",
        )
    else:
        response.set_cookie(
            key=AUTH_COOKIE_NAME,
            value=token,
            max_age=JWT_COOKIE_MAX_AGE,
            secure=True,
            httponly=True,
            samesite="Strict",
        )
    _mark_auth_cookie_as_handled(response)
    return response


def delete_auth_cookie(response: HttpResponse) -> HttpResponse:
    if env.ENV == Env.PROD:
        response.delete_cookie(
            AUTH_COOKIE_NAME, domain=PRODUCTION_DOMAIN, samesite="Lax"
        )
    else:
        response.delete_cookie(AUTH_COOKIE_NAME)
    _mark_auth_cookie_as_handled(response)
    return response
