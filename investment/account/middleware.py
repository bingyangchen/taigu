from django.contrib.auth import authenticate
from django.http import HttpRequest, HttpResponseBadRequest, JsonResponse


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
                "token", token, max_age=172800, samesite="None", secure=True
            )
        else:
            del response.headers["is-log-out"]
            del response.headers["new-token"]
        return response

    return middleware
