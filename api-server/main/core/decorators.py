from collections.abc import Callable

from django.http import HttpRequest, JsonResponse

from main.account.models import User


def require_login(func: Callable) -> Callable:
    def wrap(request: HttpRequest, *arg, **args) -> JsonResponse:  # noqa: ANN002, ANN003
        if isinstance(request.user, User) and request.user.is_authenticated:
            return func(request, *arg, **args)
        else:
            return JsonResponse({"message": "Login Required"}, status=401)

    wrap.__name__ = func.__name__
    return wrap
