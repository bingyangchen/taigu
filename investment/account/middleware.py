from django.contrib.auth import authenticate
from django.conf import settings
from django.http import HttpResponseBadRequest, JsonResponse, HttpRequest

from ..account.models import user as User


def check_login_status_middleware(get_response):
    def middleware(request: HttpRequest):
        token = None
        try:
            user = authenticate(request, token=request.COOKIES.get("token"))
        except Exception as e:
            HttpResponseBadRequest(JsonResponse({"error": str(e)}))
        if user:
            token = request.COOKIES.get("token")
        request.user = user

        response = get_response(request)

        token = token or response.get("new-token")
        if (not (response.get("is-log-out") == "yes")) and token:
            response.set_cookie(
                "token",
                token,
                max_age=settings.CSRF_COOKIE_AGE,
                samesite=settings.CSRF_COOKIE_SAMESITE,
                secure=settings.CSRF_COOKIE_SECURE,
            )
        else:
            del response.headers["is-log-out"]
            del response.headers["new-token"]
        return response

    return middleware
