from django.http import HttpRequest, JsonResponse
from django.views.decorators.http import require_GET, require_http_methods

from main.core.decorators.auth import require_login
from main.core.decorators.rate_limit import rate_limit
from main.favorite.models import Favorite
from main.stock.models import Company


@rate_limit(rate=1)
@require_login
@require_http_methods(["POST", "DELETE"])
def create_or_delete_favorite(request: HttpRequest, sid: str) -> JsonResponse:
    if request.method == "POST":
        return _create_favorite(request, sid)
    elif request.method == "DELETE":
        return _delete_favorite(request, sid)
    else:
        return JsonResponse({"message": "Method Not Allowed"}, status=405)


def _create_favorite(request: HttpRequest, sid: str) -> JsonResponse:
    company = Company.objects.get(pk=sid)
    Favorite.objects.get_or_create(owner=request.user, company=company)
    return JsonResponse({"sid": sid})


def _delete_favorite(request: HttpRequest, sid: str) -> JsonResponse:
    company = Company.objects.get(pk=sid)
    Favorite.objects.get(owner=request.user, company=company).delete()
    return JsonResponse({"sid": sid})


@rate_limit(rate=2)
@require_GET
@require_login
def list_favorites(request: HttpRequest) -> JsonResponse:
    query_set = Favorite.objects.filter(owner=request.user).select_related("company")
    return JsonResponse({"data": [favorite.company.pk for favorite in query_set]})
