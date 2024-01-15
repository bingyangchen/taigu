import json
import os

import google_auth_oauthlib.flow
from django.contrib.auth import authenticate
from django.contrib.auth.hashers import check_password
from django.core.exceptions import ValidationError
from django.http import HttpRequest, JsonResponse
from django.views.decorators.http import require_GET, require_POST
from google.auth.transport.requests import Request as GoogleRequest
from google.oauth2 import id_token
from rest_framework.authtoken.models import Token

from main.core.decorators import require_login

from . import OAuthOrganization
from .models import User
from .utils import update_user, validate_registration_info

GOOGLE_AUTH_FLOW = google_auth_oauthlib.flow.Flow.from_client_secrets_file(
    os.path.join(
        os.getcwd(),
        "client_secret_85674097625-iqmtaroea8456oeh3461j2g8esb426ts.apps.googleusercontent.com.json",
    ),
    scopes=[
        "openid",
        "https://www.googleapis.com/auth/userinfo.email",
        "https://www.googleapis.com/auth/userinfo.profile",
    ],
)


@require_POST
def register(request: HttpRequest):
    result: dict = {"success": False}
    try:
        username = request.POST.get("username")
        email = request.POST.get("email")
        password = request.POST.get("password")

        validate_registration_info(username, email, password)
        User.objects.create_user(email, password, username=username)

        result["success"] = True
        return JsonResponse(result)
    except Exception as e:
        if isinstance(e, ValidationError):
            result["error"] = e.messages[0]
        else:
            result["error"] = str(e)
        return JsonResponse(result, status=400)


@require_POST
def login(request: HttpRequest):
    result: dict = {"success": False}
    if (email := request.POST.get("email")) and (
        password := request.POST.get("password")
    ):
        try:
            user = authenticate(request, email=email, password=password)
            request.user = user
            token = Token.objects.get_or_create(user=user)[0].key
            result["success"] = True

            http_response = JsonResponse(result)
            http_response.headers["new-token"] = token
            return http_response
        except Exception as e:
            result["error"] = str(e)
            return JsonResponse(result, status=400)
    else:
        result["error"] = "Data Not Sufficient"
        return JsonResponse(result, status=400)


def google_login(request: HttpRequest):
    result: dict = {"success": False}
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
                credentials.id_token,
                GoogleRequest(),
                GOOGLE_AUTH_FLOW.client_config["client_id"],
            )

            # Get user to login or register a new user
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
            jwt = Token.objects.get_or_create(user=user)[0].key
            result["success"] = True
            http_response = JsonResponse(result)
            http_response.headers["new-token"] = jwt
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
            "username": request.user.username,
            "email": request.user.email,
            "avatar_url": request.user.avatar_url or None,
        },
    }
    return JsonResponse(result)


@require_GET
@require_login
def logout(request: HttpRequest):
    result = {"success": False}
    Token.objects.filter(user=request.user).delete()
    result["success"] = True
    http_response = JsonResponse(result)
    http_response.headers["is-log-out"] = "yes"
    http_response.delete_cookie("token", samesite="None")
    return http_response


@require_POST
@require_login
def update(request: HttpRequest):
    result: dict = {"success": False, "data": None}
    try:
        payload = json.loads(request.body)

        user = update_user(
            id=payload.get("id") or request.user.pk,
            username=payload.get("username"),
            email=payload.get("email"),
            avatar_url=payload.get("avatar_url"),
            old_password=payload.get("old_password"),
            new_password=payload.get("new_password"),
        )

        result["success"] = True
        result["data"] = {
            "id": user.pk,
            "username": user.username,
            "email": user.email,
            "avatar_url": user.avatar_url or None,
        }
        return JsonResponse(result)
    except Exception as e:
        if isinstance(e, ValidationError):
            result["error"] = e.messages[0]
        else:
            result["error"] = str(e)
        return JsonResponse(result, status=400)


@require_login
def delete(request: HttpRequest):
    result: dict = {"success": False}
    if request.method == "DELETE":
        password = json.loads(request.body).get("password")
        if check_password(password, request.user.password):
            Token.objects.filter(user=request.user).delete()
            request.user.delete()
            result["success"] = True
            http_response = JsonResponse(result)
            http_response.headers["is-log-out"] = "yes"
            http_response.delete_cookie("token", samesite="None")
            return http_response
        else:
            result["error"] = "Wrong Password"
            return JsonResponse(result, status=400)
    else:
        result["error"] = "DELETE Method Required"
        return JsonResponse(result, status=405)
