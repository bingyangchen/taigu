from collections.abc import Callable

from django.contrib.auth import authenticate
from django.http import HttpRequest, HttpResponse

from main.account.cookies import (
    delete_access_cookie,
    get_access_token,
    has_auth_cookie_been_handled,
)


def check_login_status_middleware(
    get_response: Callable[..., HttpResponse],
) -> Callable:
    def middleware(request: HttpRequest) -> HttpResponse:
        token: str = get_access_token(request).strip()
        user = authenticate(request, token=token)  # request.user will be modified here
        token = token if user else ""

        response = get_response(request)

        if response.status_code == 401:
            response = delete_access_cookie(response)
        elif not has_auth_cookie_been_handled(response):
            if get_access_token(request) and not token:
                response = delete_access_cookie(response)

        return response

    return middleware
