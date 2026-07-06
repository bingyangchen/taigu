import json
import logging
from datetime import timedelta

from django.core.exceptions import ValidationError
from django.db.models import Q
from django.http import HttpRequest, JsonResponse
from django.utils import timezone
from django.views.decorators.csrf import ensure_csrf_cookie
from django.views.decorators.http import require_GET, require_POST
from google.auth.transport.requests import Request as GoogleRequest
from google.oauth2 import id_token
from google_auth_oauthlib import flow as google_oauth_flow
from pydantic import BaseModel

from main.account import OAuthOrganization
from main.account.cookies import (
    delete_auth_cookies,
    get_refresh_token,
    set_auth_cookies,
)
from main.account.models import User
from main.account.tokens import (
    InvalidRefreshTokenError,
    issue_token_pair,
    revoke_refresh_token,
    rotate_refresh_token,
)
from main.billing.services.entitlements import (
    ensure_billing_profile,
    serialize_account_subscription,
)
from main.core.decorators.auth import require_login
from main.core.decorators.rate_limit import rate_limit
from main.env import env
from main.origins import build_frontend_urls

logger = logging.getLogger(__name__)

# Docs: https://github.com/googleapis/google-api-python-client/blob/main/docs/client-secrets.md
GOOGLE_CLIENT_CONFIG = {
    "web": {
        "client_id": env.GOOGLE_CLIENT_ID,
        "project_id": env.GOOGLE_PROJECT_ID,
        "auth_uri": "https://accounts.google.com/o/oauth2/auth",
        "token_uri": "https://oauth2.googleapis.com/token",
        "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
        "client_secret": env.GOOGLE_CLIENT_SECRET,
        "redirect_uris": build_frontend_urls("/login", "/settings/account-binding"),
    }
}
SCOPES = [
    "openid",
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/userinfo.profile",
]
OPEN_SESSION_LAST_LOGIN_UPDATE_INTERVAL = timedelta(minutes=5)


class TokenVerificationResult(BaseModel):
    sub: str
    email: str
    name: str
    picture: str


def _verify_with_code_flow(code: str, redirect_uri: str) -> TokenVerificationResult:
    flow = google_oauth_flow.Flow.from_client_config(
        GOOGLE_CLIENT_CONFIG, scopes=SCOPES
    )
    flow.redirect_uri = redirect_uri
    flow.fetch_token(code=code)
    credentials = flow.credentials
    verified_result = id_token.verify_oauth2_token(
        credentials.id_token,  # type: ignore
        GoogleRequest(),
        flow.client_config["client_id"],
        clock_skew_in_seconds=10,  # Allow 10 seconds of clock skew
    )
    return TokenVerificationResult.model_validate(verified_result)


def _set_new_token_pair(response: JsonResponse, user: User) -> JsonResponse:
    token_pair = issue_token_pair(user)
    return set_auth_cookies(response, token_pair.access_token, token_pair.refresh_token)


@ensure_csrf_cookie
@require_GET
def get_authorization_url(request: HttpRequest) -> JsonResponse:
    redirect_uri = request.GET.get("redirect_uri")
    if not redirect_uri:
        return JsonResponse({"message": "redirect_uri is required"}, status=400)

    flow = google_oauth_flow.Flow.from_client_config(
        GOOGLE_CLIENT_CONFIG, scopes=SCOPES
    )
    flow.redirect_uri = redirect_uri
    authorization_url, state = flow.authorization_url(include_granted_scopes="true")
    return JsonResponse({"authorization_url": authorization_url, "state": state})


@require_POST
def google_login(request: HttpRequest) -> JsonResponse:
    code, redirect_uri = request.POST.get("code"), request.POST.get("redirect_uri")
    if not code or not redirect_uri:
        return JsonResponse({"message": "Data Not Sufficient"}, status=400)

    verified_result = _verify_with_code_flow(str(code), str(redirect_uri))

    # login an existing user or register a new user
    user, _ = User.objects.get_or_create(
        oauth_org=OAuthOrganization.GOOGLE,
        oauth_id=verified_result.sub,
        defaults={
            "email": verified_result.email,
            "username": verified_result.name,
            "avatar_url": verified_result.picture,
        },
    )
    ensure_billing_profile(user)
    request.user = user  # type: ignore
    return _set_new_token_pair(JsonResponse({}), user)


@rate_limit(rate=0.5)
@require_POST
@require_login
def change_google_binding(request: HttpRequest) -> JsonResponse:
    code, redirect_uri = request.POST.get("code"), request.POST.get("redirect_uri")
    if not code or not redirect_uri:
        return JsonResponse({"message": "Data Not Sufficient"}, status=400)

    verified_result = _verify_with_code_flow(str(code), str(redirect_uri))

    # Check if the given google account is not bound to any other account
    if User.objects.filter(
        oauth_org=OAuthOrganization.GOOGLE, oauth_id=verified_result.sub
    ).exists():
        return JsonResponse(
            {"message": "This Google account is already bound to another account."},
            status=400,
        )

    user: User = request.user
    user.oauth_org = OAuthOrganization.GOOGLE
    user.oauth_id = verified_result.sub
    user.email = verified_result.email
    user.username = verified_result.name
    user.avatar_url = verified_result.picture
    user.save()

    response = JsonResponse(
        {
            "id": str(user.id),
            "email": user.email,
            "username": user.username,
            "avatar_url": user.avatar_url,
            "subscription": serialize_account_subscription(user),
        }
    )
    return _set_new_token_pair(response, user)


@rate_limit(rate=5)
@ensure_csrf_cookie
@require_GET
@require_login
def me(request: HttpRequest) -> JsonResponse:
    return JsonResponse(
        {
            "id": request.user.pk,
            "username": request.user.username,
            "email": request.user.email,
            "avatar_url": request.user.avatar_url or None,
            "subscription": serialize_account_subscription(request.user),
        }
    )


@require_POST
@require_login
def open_session(request: HttpRequest) -> JsonResponse:
    now = timezone.now()
    update_before = now - OPEN_SESSION_LAST_LOGIN_UPDATE_INTERVAL
    User.objects.filter(pk=request.user.pk).filter(
        Q(last_login__isnull=True) | Q(last_login__lt=update_before)
    ).update(last_login=now)
    return JsonResponse({})


@require_POST
def refresh_token(request: HttpRequest) -> JsonResponse:
    try:
        token_pair = rotate_refresh_token(get_refresh_token(request))
    except InvalidRefreshTokenError:
        return delete_auth_cookies(JsonResponse({}, status=401))
    return set_auth_cookies(
        JsonResponse({}), token_pair.access_token, token_pair.refresh_token
    )


@require_POST
def logout(request: HttpRequest) -> JsonResponse:
    revoke_refresh_token(get_refresh_token(request))
    return delete_auth_cookies(JsonResponse({}))


@rate_limit(rate=0.5)
@require_POST
@require_login
def update(request: HttpRequest) -> JsonResponse:
    try:
        payload = json.loads(request.body)
        user: User = request.user  # type: ignore
        if (username := payload.get("username")) is not None:
            user.username = username
        if avatar_url := payload.get("avatar_url"):
            user.avatar_url = avatar_url
        elif avatar_url == "":
            user.avatar_url = None  # type: ignore
        user.save()
        return JsonResponse(
            {
                "id": user.pk,
                "username": user.username,
                "email": user.email,
                "avatar_url": user.avatar_url or None,
                "subscription": serialize_account_subscription(user),
            }
        )
    except ValidationError as e:
        return JsonResponse({"message": e.messages[0]}, status=400)
