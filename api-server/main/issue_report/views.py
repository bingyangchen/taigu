import json

from django.http import HttpRequest, JsonResponse
from django.views.decorators.http import require_POST

from main.core.decorators.auth import require_login
from main.core.decorators.rate_limit import rate_limit
from main.issue_report.models import BODY_MAX_LENGTH, IssueReport
from main.usage.models import Platform


def _parse_plain_text_body(payload: dict) -> str | None:
    if "body" not in payload:
        return None
    value = payload["body"]
    if not isinstance(value, str):
        return None
    normalized = value.strip()
    if not normalized or len(normalized) > BODY_MAX_LENGTH:
        return None
    return normalized


@require_POST
@require_login
@rate_limit(rate=1)
def create_issue_report(request: HttpRequest) -> JsonResponse:
    payload = json.loads(request.body)
    body = _parse_plain_text_body(payload)
    if body is None:
        return JsonResponse({"message": "Invalid body"}, status=400)

    platform = payload.get("platform")
    report = IssueReport.objects.create(
        user=request.user,
        body=body,
        # An unknown platform is dropped instead of rejected, because what the user
        # wrote matters more than the platform.
        platform=platform if platform in Platform.values else None,
        user_agent=request.headers.get("User-Agent"),
    )
    return JsonResponse(
        {
            "id": report.pk,
            "body": report.body,
            "created_at": report.created_at.isoformat(),
        }
    )
