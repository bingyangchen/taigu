from django.http import HttpResponse

from main.account import AUTH_COOKIE_NAME
from main.env import Env, env

JWT_COOKIE_MAX_AGE = 5 * 24 * 60 * 60  # 5 days
PRODUCTION_DOMAIN = "taigu.tw"


def set_auth_cookie(response: HttpResponse, token: str) -> HttpResponse:
    if env.ENV == Env.PROD:
        response.set_cookie(
            key=AUTH_COOKIE_NAME,
            value=token,
            max_age=JWT_COOKIE_MAX_AGE,
            domain=PRODUCTION_DOMAIN,
            secure=True,
            httponly=True,
            samesite="None",
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
    return response


def delete_auth_cookie(response: HttpResponse) -> HttpResponse:
    if env.ENV == Env.PROD:
        response.delete_cookie(
            AUTH_COOKIE_NAME, domain=PRODUCTION_DOMAIN, samesite="None"
        )
    else:
        response.delete_cookie(AUTH_COOKIE_NAME)
    return response
