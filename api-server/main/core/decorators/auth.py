from collections.abc import Callable
from functools import wraps

from django.http import Http404, HttpRequest, JsonResponse

from main.account.models import User


def require_login(func: Callable) -> Callable:
    @wraps(func)
    def wrap(request: HttpRequest, *args, **kwargs) -> JsonResponse:  # noqa: ANN002, ANN003
        if (
            hasattr(request, "user")
            and isinstance(request.user, User)
            and request.user.is_authenticated
        ):
            return func(request, *args, **kwargs)
        else:
            return JsonResponse({"message": "Login Required"}, status=401)

    return wrap


def require_superuser(func: Callable) -> Callable:
    """
    Must run after `require_login` and before the HTTP method decorators, so a
    non-superuser gets the same response as an unknown URL whatever the method.
    """

    @wraps(func)
    def wrap(request: HttpRequest, *args, **kwargs) -> JsonResponse:  # noqa: ANN002, ANN003
        if not request.user.is_superuser:
            raise Http404
        return func(request, *args, **kwargs)

    return wrap
