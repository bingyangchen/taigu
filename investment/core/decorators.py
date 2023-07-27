from typing import Callable

from django.http import HttpRequest, JsonResponse


def require_login(func: Callable) -> Callable:
    def wrap(request: HttpRequest, *arg, **args):
        if request.user:
            return func(request, *arg, **args)
        else:
            return JsonResponse({"error": "Login Required"}, status=401)

    wrap.__name__ = func.__name__
    return wrap
