from typing import Callable

from django.conf import settings
from django.contrib.auth import authenticate
from django.http import HttpRequest, HttpResponse, HttpResponseBadRequest, JsonResponse


def check_login_status_middleware(get_response: Callable[..., HttpResponse]):
    def middleware(request: HttpRequest) -> HttpResponse:
        try:
            user = authenticate(request, token=request.COOKIES.get("token"))
        except Exception as e:
            return HttpResponseBadRequest(JsonResponse({"error": str(e)}))

        token = request.COOKIES.get("token") if user else None
        request.user = user

        response = get_response(request)

        if response.status_code == 401:
            response.delete_cookie(
                "token", samesite="Strict" if not settings.DEBUG else "None"
            )
        else:
            token = token or response.get("new-token")
            if (response.get("is-log-out") != "yes") and token:
                response.set_cookie(
                    key="token",
                    value=token,
                    max_age=172800,
                    secure=True,
                    httponly=True,
                    samesite="Strict" if not settings.DEBUG else "None",
                )
            else:
                del response.headers["is-log-out"]
                del response.headers["new-token"]
        return response

    return middleware
