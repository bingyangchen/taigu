import json
import logging
import os
from datetime import datetime, timedelta

from django.conf import settings
from django.core.exceptions import ValidationError
from django.http import HttpRequest, JsonResponse
from django.views.decorators.http import require_GET, require_POST
from google.auth.transport.requests import Request as GoogleRequest
from google.oauth2 import id_token
from google_auth_oauthlib import flow as google_oauth_flow
from jose import jwt
from jose.constants import ALGORITHMS

from main.account import AUTH_COOKIE_NAME, OAuthOrganization
from main.account.models import User
from main.core.decorators import require_login

logger = logging.getLogger(__name__)


def google_login(request: HttpRequest) -> JsonResponse:
    flow = google_oauth_flow.Flow.from_client_secrets_file(
        os.path.join(settings.BASE_DIR, "google_client_secret.json"),
        scopes=[
            "openid",
            "https://www.googleapis.com/auth/userinfo.email",
            "https://www.googleapis.com/auth/userinfo.profile",
        ],
    )
    result = {}
    if (request.method == "GET") and (redirect_uri := request.GET.get("redirect_uri")):
        flow.redirect_uri = redirect_uri
        (
            result["authorization_url"],
            result["state"],
        ) = flow.authorization_url(include_granted_scopes="true")
        return JsonResponse(result)
    elif (
        (request.method == "POST")
        and (code := request.POST.get("code"))
        and (redirect_uri := request.POST.get("redirect_uri"))
    ):
        flow.redirect_uri = redirect_uri
        flow.fetch_token(code=code)
        credentials = flow.credentials
        verify_result = id_token.verify_oauth2_token(
            credentials.id_token,  # type: ignore
            GoogleRequest(),
            flow.client_config["client_id"],
        )

        # login an existing user or register a new user
        user, _ = User.objects.get_or_create(
            oauth_org=OAuthOrganization.GOOGLE,
            oauth_id=verify_result["sub"],
            defaults={
                "email": verify_result["email"],
                "username": verify_result["name"],
                "avatar_url": verify_result["picture"],
            },
        )
        request.user = user
        jwt_ = jwt.encode(
            {
                "id": str(user.id),
                "oauth_id": user.oauth_id,
                "iat": int(datetime.now().timestamp()),
                "exp": int((datetime.now() + timedelta(days=30)).timestamp()),
            },
            key=settings.SECRET_KEY,
            algorithm=ALGORITHMS.HS256,
        )
        http_response = JsonResponse(result, headers={"is-log-in": "yes"})
        http_response.set_cookie(
            AUTH_COOKIE_NAME,
            value=jwt_,
            max_age=172800,
            secure=True,
            httponly=True,
            samesite="Strict",
        )
        return http_response
    else:
        return JsonResponse({"message": "Data Not Sufficient"}, status=400)


@require_POST
@require_login
def change_google_binding(request: HttpRequest) -> JsonResponse:
    flow = google_oauth_flow.Flow.from_client_secrets_file(
        os.path.join(settings.BASE_DIR, "google_client_secret.json"),
        scopes=[
            "openid",
            "https://www.googleapis.com/auth/userinfo.email",
            "https://www.googleapis.com/auth/userinfo.profile",
        ],
    )
    result = {}
    code, redirect_uri = request.POST.get("code"), request.POST.get("redirect_uri")
    if not code or not redirect_uri:
        return JsonResponse({"message": "Data Not Sufficient"}, status=400)

    flow.redirect_uri = redirect_uri
    flow.fetch_token(code=code)
    credentials = flow.credentials
    verify_result = id_token.verify_oauth2_token(
        credentials.id_token,  # type: ignore
        GoogleRequest(),
        flow.client_config["client_id"],
    )

    # Check if the given google account is not bound to any other account
    if (
        User.objects.filter(
            oauth_org=OAuthOrganization.GOOGLE, oauth_id=verify_result["sub"]
        ).first()
        is not None
    ):
        return JsonResponse(
            {"message": "This Google account is already bound to another account."},
            status=400,
        )

    user: User = request.user  # type: ignore
    user.oauth_org = OAuthOrganization.GOOGLE
    user.oauth_id = verify_result["sub"]
    user.email = verify_result["email"]
    user.username = verify_result["name"]
    user.avatar_url = verify_result["picture"]
    user.save()

    jwt_ = jwt.encode(
        {
            "id": str(user.id),
            "oauth_id": user.oauth_id,
            "iat": int(datetime.now().timestamp()),
            "exp": int((datetime.now() + timedelta(days=30)).timestamp()),
        },
        key=settings.SECRET_KEY,
        algorithm=ALGORITHMS.HS256,
    )
    result["id"] = str(user.id)
    result["email"] = user.email
    result["username"] = user.username
    result["avatar_url"] = user.avatar_url
    http_response = JsonResponse(result, headers={"is-log-in": "yes"})
    http_response.set_cookie(
        AUTH_COOKIE_NAME,
        value=jwt_,
        max_age=259200,
        secure=True,
        httponly=True,
        samesite="Strict",
    )
    return http_response


@require_GET
@require_login
def me(request: HttpRequest) -> JsonResponse:
    return JsonResponse(
        {
            "id": request.user.pk,
            "username": request.user.username,  # type: ignore
            "email": request.user.email,  # type: ignore
            "avatar_url": request.user.avatar_url or None,  # type: ignore
        }
    )


@require_GET
@require_login
def logout(request: HttpRequest) -> JsonResponse:
    http_response = JsonResponse({}, headers={"is-log-out": "yes"})
    http_response.delete_cookie(AUTH_COOKIE_NAME)
    return http_response


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
            user.avatar_url = None
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
