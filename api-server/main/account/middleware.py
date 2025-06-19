from typing import Callable

from django.contrib.auth import authenticate
from django.http import HttpRequest, HttpResponse

from main.account import AUTH_COOKIE_NAME


def check_login_status_middleware(
    get_response: Callable[..., HttpResponse],
) -> Callable:
    def middleware(request: HttpRequest) -> HttpResponse:
        token = request.COOKIES.get(AUTH_COOKIE_NAME)
        user = authenticate(request, token=token)  # request.user will be modified here
        token = token if user else None

        response = get_response(request)

        if response.status_code == 401:
            response.delete_cookie(AUTH_COOKIE_NAME)
        elif response.get("is-log-out") != "yes" and response.get("is-log-in") != "yes":
            if token:
                # refresh the max_age of the auth cookie every time
                response.set_cookie(
                    key=AUTH_COOKIE_NAME,
                    value=token,
                    max_age=172800,
                    secure=True,
                    httponly=True,
                    samesite="Strict",
                )
            else:
                response.delete_cookie(AUTH_COOKIE_NAME)
        # Delete all the custom headers that may appear (KeyError won't be raised)
        del response["is-log-out"]
        del response["is-log-in"]
        return response

    return middleware
