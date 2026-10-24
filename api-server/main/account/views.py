import json
import logging
from collections.abc import Callable
from datetime import timedelta
from functools import partial, wraps

import requests
from django.core.exceptions import ValidationError
from django.db.models import Q
from django.http import HttpRequest, JsonResponse
from django.utils import timezone
from django.views.decorators.csrf import ensure_csrf_cookie
from django.views.decorators.http import require_GET, require_POST
from google.auth import exceptions as google_auth_exceptions
from google.auth.transport.requests import Request as GoogleRequest
from google.oauth2 import id_token
from google_auth_oauthlib import flow as google_oauth_flow
from pydantic import BaseModel

from main.account import OAuthOrganization
from main.account.cookies import (
    delete_auth_cookies,
    delete_oauth_cookie,
    get_oauth_code_verifier,
    get_refresh_token,
    set_auth_cookies,
    set_oauth_cookie,
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
from main.usage.models import DailyActivity, Platform

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
GOOGLE_REQUEST_TIMEOUT_SECONDS = 10
GOOGLE_LOGIN_FAILED_MESSAGE = "登入失敗，請重新登入。"
GOOGLE_BINDING_FAILED_MESSAGE = "更換綁定的帳號失敗，請再試一次。"
OPEN_SESSION_LAST_LOGIN_UPDATE_INTERVAL = timedelta(minutes=5)


class TokenVerificationResult(BaseModel):
    sub: str
    email: str
    name: str
    picture: str


class GoogleAuthorizationError(Exception):
    def __init__(self, status: int) -> None:
        super().__init__()
        self.status = status


def _raise_for_rejected_authorization(response: requests.Response) -> requests.Response:
    """
    Runs before requests-oauthlib parses the token response, which would otherwise
    turn a 5xx body into an OAuth error. Errors other than `invalid_grant`, such as
    `invalid_client` from a wrong client secret, are left to raise.
    """
    if response.status_code >= 500:
        response.raise_for_status()
    if (
        response.status_code == 400
        and (body := response.json()).get("error") == "invalid_grant"
    ):
        logger.warning("Google rejected the authorization: %s", body)
        raise GoogleAuthorizationError(status=400)
    return response


def _verify_with_code_flow(
    code: str, redirect_uri: str, code_verifier: str
) -> TokenVerificationResult:
    flow = google_oauth_flow.Flow.from_client_config(
        GOOGLE_CLIENT_CONFIG, scopes=SCOPES, code_verifier=code_verifier
    )
    flow.redirect_uri = redirect_uri
    flow.oauth2session.register_compliance_hook(
        "access_token_response", _raise_for_rejected_authorization
    )
    try:
        flow.fetch_token(code=code, timeout=GOOGLE_REQUEST_TIMEOUT_SECONDS)
        verified_result = id_token.verify_oauth2_token(
            flow.credentials.id_token,  # type: ignore
            partial(GoogleRequest(), timeout=GOOGLE_REQUEST_TIMEOUT_SECONDS),
            flow.client_config["client_id"],
            clock_skew_in_seconds=10,
        )
    # TransportError subclasses GoogleAuthError, so it must be caught first.
    except (requests.RequestException, google_auth_exceptions.TransportError) as e:
        logger.warning("Failed to reach Google: %s", e)
        raise GoogleAuthorizationError(status=502) from e
    except (google_auth_exceptions.GoogleAuthError, ValueError) as e:
        logger.warning("Failed to verify the ID token from Google: %s", e)
        raise GoogleAuthorizationError(status=400) from e
    return TokenVerificationResult.model_validate(verified_result)


def _require_google_authorization(failure_message: str) -> Callable:
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        def wrap(request: HttpRequest) -> JsonResponse:
            code = request.POST.get("code")
            redirect_uri = request.POST.get("redirect_uri")
            if not code or not redirect_uri:
                return JsonResponse({"message": "Data Not Sufficient"}, status=400)

            code_verifier = get_oauth_code_verifier(
                request, request.POST.get("state", "")
            )
            if code_verifier is None:
                return JsonResponse({"message": failure_message}, status=400)

            try:
                google_account = _verify_with_code_flow(
                    code, redirect_uri, code_verifier
                )
            except GoogleAuthorizationError as e:
                response = JsonResponse({"message": failure_message}, status=e.status)
            else:
                response = func(request, google_account)
            # The callback URL counts as processed even when Google rejects it
            # (ACCT-R12), so the cookie is deleted whatever the response is.
            return delete_oauth_cookie(response)

        return wrap

    return decorator


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
        GOOGLE_CLIENT_CONFIG, scopes=SCOPES, autogenerate_code_verifier=True
    )
    flow.redirect_uri = redirect_uri
    authorization_url, state = flow.authorization_url(include_granted_scopes="true")
    return set_oauth_cookie(
        JsonResponse({"authorization_url": authorization_url}),
        state,
        flow.code_verifier,  # type: ignore
    )


@require_POST
@_require_google_authorization(GOOGLE_LOGIN_FAILED_MESSAGE)
def google_login(
    request: HttpRequest, google_account: TokenVerificationResult
) -> JsonResponse:
    # login an existing user or register a new user
    user, _ = User.objects.get_or_create(
        oauth_org=OAuthOrganization.GOOGLE,
        oauth_id=google_account.sub,
        defaults={
            "email": google_account.email,
            "username": google_account.name,
            "avatar_url": google_account.picture,
        },
    )
    ensure_billing_profile(user)
    request.user = user  # type: ignore
    return _set_new_token_pair(JsonResponse({}), user)


@require_POST
@require_login
@rate_limit(rate=0.5)
@_require_google_authorization(GOOGLE_BINDING_FAILED_MESSAGE)
def change_google_binding(
    request: HttpRequest, google_account: TokenVerificationResult
) -> JsonResponse:
    # Check if the given google account is not bound to any other account
    if User.objects.filter(
        oauth_org=OAuthOrganization.GOOGLE, oauth_id=google_account.sub
    ).exists():
        return JsonResponse(
            {"message": "This Google account is already bound to another account."},
            status=400,
        )

    user: User = request.user
    user.oauth_org = OAuthOrganization.GOOGLE
    user.oauth_id = google_account.sub
    user.email = google_account.email
    user.username = google_account.name
    user.avatar_url = google_account.picture
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


@ensure_csrf_cookie
@require_GET
@require_login
@rate_limit(rate=5)
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
    platform = request.POST.get("platform")
    if platform is not None and platform not in Platform.values:
        return JsonResponse({"message": "Invalid platform"}, status=400)

    now = timezone.now()
    update_before = now - OPEN_SESSION_LAST_LOGIN_UPDATE_INTERVAL
    User.objects.filter(pk=request.user.pk).filter(
        Q(last_login__isnull=True) | Q(last_login__lt=update_before)
    ).update(last_login=now)
    DailyActivity.objects.get_or_create(
        user=request.user, date=timezone.localdate(now), platform=platform
    )
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


@require_POST
@require_login
@rate_limit(rate=0.5)
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
