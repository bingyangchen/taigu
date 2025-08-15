import json
import logging
from datetime import datetime, timedelta

from django.conf import settings
from django.core.exceptions import ValidationError
from django.http import HttpRequest, JsonResponse
from django.views.decorators.csrf import ensure_csrf_cookie
from django.views.decorators.http import require_GET, require_POST
from google.auth.transport.requests import Request as GoogleRequest
from google.oauth2 import id_token
from google_auth_oauthlib import flow as google_oauth_flow
from jose import jwt
from jose.constants import ALGORITHMS
from pydantic import BaseModel

from main.account import AUTH_COOKIE_NAME, OAuthOrganization
from main.account.models import User
from main.core.decorators import require_login
from main.env import env

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
        "redirect_uris": [
            "https://localhost/login",
            "https://localhost/settings/account-binding",
            "https://taigu.tw/login",
            "https://taigu.tw/settings/account-binding",
        ],
    }
}
SCOPES = [
    "openid",
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/userinfo.profile",
]
JWT_COOKIE_MAX_AGE = 5 * 24 * 60 * 60  # 5 days


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


def _make_jwt(user_id: str) -> str:
    return jwt.encode(
        {"id": user_id, "exp": int((datetime.now() + timedelta(days=30)).timestamp())},
        key=settings.SECRET_KEY,
        algorithm=ALGORITHMS.HS256,
    )


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
    request.user = user  # type: ignore
    response = JsonResponse({}, headers={"is-log-in": "yes"})
    response.set_cookie(
        AUTH_COOKIE_NAME,
        value=_make_jwt(str(user.id)),
        max_age=JWT_COOKIE_MAX_AGE,
        secure=True,
        httponly=True,
        samesite="Strict",
    )
    return response


@require_POST
@require_login
def change_google_binding(request: HttpRequest) -> JsonResponse:
    code, redirect_uri = request.POST.get("code"), request.POST.get("redirect_uri")
    if not code or not redirect_uri:
        return JsonResponse({"message": "Data Not Sufficient"}, status=400)

    verified_result = _verify_with_code_flow(str(code), str(redirect_uri))

    # Check if the given google account is not bound to any other account
    if (
        User.objects.filter(
            oauth_org=OAuthOrganization.GOOGLE, oauth_id=verified_result.sub
        ).first()
        is not None
    ):
        return JsonResponse(
            {"message": "This Google account is already bound to another account."},
            status=400,
        )

    user: User = request.user  # type: ignore
    user.oauth_org = OAuthOrganization.GOOGLE  # type: ignore
    user.oauth_id = verified_result.sub  # type: ignore
    user.email = verified_result.email  # type: ignore
    user.username = verified_result.name  # type: ignore
    user.avatar_url = verified_result.picture  # type: ignore
    user.save()

    response = JsonResponse(
        {
            "id": str(user.id),
            "email": user.email,
            "username": user.username,
            "avatar_url": user.avatar_url,
        },
        headers={"is-log-in": "yes"},
    )
    response.set_cookie(
        AUTH_COOKIE_NAME,
        value=_make_jwt(str(user.id)),
        max_age=JWT_COOKIE_MAX_AGE,
        secure=True,
        httponly=True,
        samesite="Strict",
    )
    return response


@require_GET
@require_login
def me(request: HttpRequest) -> JsonResponse:
    return JsonResponse(
        {
            "id": request.user.pk,  # type: ignore
            "username": request.user.username,  # type: ignore
            "email": request.user.email,  # type: ignore
            "avatar_url": request.user.avatar_url or None,  # type: ignore
        }
    )


@require_GET
@require_login
def logout(request: HttpRequest) -> JsonResponse:
    response = JsonResponse({}, headers={"is-log-out": "yes"})
    response.delete_cookie(AUTH_COOKIE_NAME)
    return response


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
            }
        )
    except ValidationError as e:
        return JsonResponse({"message": e.messages[0]}, status=400)
