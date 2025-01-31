import json
import os
from datetime import datetime, timedelta
from typing import Any

import google_auth_oauthlib.flow
from django.conf import settings
from django.core.exceptions import ValidationError
from django.http import HttpRequest, JsonResponse
from django.views.decorators.http import require_GET, require_POST
from google.auth.transport.requests import Request as GoogleRequest
from google.oauth2 import id_token
from jose import jwt
from jose.constants import ALGORITHMS

from main.core import env
from main.core.decorators import require_login

from . import AUTH_COOKIE_NAME, OAuthOrganization
from .models import User

GOOGLE_AUTH_FLOW = google_auth_oauthlib.flow.Flow.from_client_secrets_file(
    os.path.join(
        settings.BASE_DIR,
        "client_secret_85674097625-iqmtaroea8456oeh3461j2g8esb426ts.apps.googleusercontent.com.json",
    ),
    scopes=[
        "openid",
        "https://www.googleapis.com/auth/userinfo.email",
        "https://www.googleapis.com/auth/userinfo.profile",
    ],
)


def google_login(request: HttpRequest):
    result: dict[str, Any] = {"success": False}
    if (request.method == "GET") and (redirect_uri := request.GET.get("redirect_uri")):
        try:
            GOOGLE_AUTH_FLOW.redirect_uri = redirect_uri
            (
                result["authorization_url"],
                result["state"],
            ) = GOOGLE_AUTH_FLOW.authorization_url(include_granted_scopes="true")
            result["success"] = True
            http_response = JsonResponse(result)
            return http_response
        except Exception as e:
            result["error"] = str(e)
            return JsonResponse(result, status=400)
    elif (
        (request.method == "POST")
        and (code := request.POST.get("code"))
        and (redirect_uri := request.POST.get("redirect_uri"))
    ):
        try:
            GOOGLE_AUTH_FLOW.redirect_uri = redirect_uri
            GOOGLE_AUTH_FLOW.fetch_token(code=code)
            credentials = GOOGLE_AUTH_FLOW.credentials
            verify_result = id_token.verify_oauth2_token(
                credentials.id_token,  # type: ignore
                GoogleRequest(),
                GOOGLE_AUTH_FLOW.client_config["client_id"],
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
            result["success"] = True
            http_response = JsonResponse(result, headers={"is-log-in": "yes"})
            http_response.set_cookie(
                AUTH_COOKIE_NAME,
                value=jwt_,
                max_age=172800,
                secure=True,
                httponly=True,
                samesite="Strict" if env.is_production else "None",
            )
            return http_response
        except Exception as e:
            result["error"] = str(e)
            return JsonResponse(result, status=400)
    else:
        result["error"] = "Data Not Sufficient"
        return JsonResponse(result, status=400)


@require_GET
@require_login
def me(request: HttpRequest):
    result = {
        "success": True,
        "data": {
            "id": request.user.pk,
            "username": request.user.username,  # type: ignore
            "email": request.user.email,  # type: ignore
            "avatar_url": request.user.avatar_url or None,  # type: ignore
        },
    }
    return JsonResponse(result)


@require_GET
@require_login
def logout(request: HttpRequest):
    http_response = JsonResponse({"success": True}, headers={"is-log-out": "yes"})
    http_response.delete_cookie(
        AUTH_COOKIE_NAME,
        samesite="Strict" if env.is_production else "None",  # type: ignore
    )
    return http_response


@require_POST
@require_login
def update(request: HttpRequest):
    result: dict = {"success": False, "data": None}
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

        result["success"] = True
        result["data"] = {
            "id": user.pk,
            "username": user.username,
            "email": user.email,
            "avatar_url": user.avatar_url or None,
        }
        return JsonResponse(result)
    except Exception as e:
        result["error"] = e.messages[0] if isinstance(e, ValidationError) else str(e)
        return JsonResponse(result, status=400)


# @require_login
# def delete(request: HttpRequest):
#     result: dict = {"success": False}
#     if request.method == "DELETE":
#         request.user.delete()
#         result["success"] = True
#         http_response = JsonResponse(result, headers={"is-log-out": "yes"})
#         http_response.delete_cookie(
#             AUTH_COOKIE_NAME, samesite="Strict" if env.is_production else "None"
#         )
#         return http_response
#     else:
#         result["error"] = "DELETE Method Required"
#         return JsonResponse(result, status=405)
