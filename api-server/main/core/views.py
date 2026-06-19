from django.http import HttpRequest, JsonResponse
from django.views.decorators.http import require_GET


@require_GET
def health(request: HttpRequest) -> JsonResponse:
    return JsonResponse({"status": "ok"})
