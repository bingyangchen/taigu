from collections.abc import Callable

from django.contrib.auth import authenticate
from django.http import HttpRequest, HttpResponse

from main.account import AUTH_COOKIE_NAME
from main.account.utils import (
    delete_auth_cookie,
    has_auth_cookie_been_handled,
    set_auth_cookie,
)


def check_login_status_middleware(
    get_response: Callable[..., HttpResponse],
) -> Callable:
    def middleware(request: HttpRequest) -> HttpResponse:
        token: str = request.COOKIES.get(AUTH_COOKIE_NAME, "").strip()
        user = authenticate(request, token=token)  # request.user will be modified here
        token = token if user else ""

        response = get_response(request)

        if response.status_code == 401:
            response = delete_auth_cookie(response)
        elif not has_auth_cookie_been_handled(response):
            if token:
                # refresh the max_age of the auth cookie every time
                response = set_auth_cookie(response, token)
            else:
                response = delete_auth_cookie(response)

        return response

    return middleware
