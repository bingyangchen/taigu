import hashlib
import secrets
import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta

from django.conf import settings
from django.db import transaction
from django.utils import timezone
from jose import jwt

from main.account.models import RefreshToken, User

ACCESS_TOKEN_MAX_AGE = 15 * 60  # 15 minutes
REFRESH_TOKEN_MAX_AGE = 30 * 24 * 60 * 60  # 30 days


@dataclass(frozen=True)
class TokenPair:
    access_token: str
    refresh_token: str


class InvalidRefreshTokenError(Exception):
    pass


def _make_access_token(user_id: str) -> str:
    expires_at = timezone.now() + timedelta(seconds=ACCESS_TOKEN_MAX_AGE)
    return jwt.encode(
        {"id": user_id, "exp": int(expires_at.timestamp())},
        key=settings.SECRET_KEY,
        algorithm=settings.JWT_ALGORITHM,
    )


def _hash_refresh_token(raw_token: str) -> str:
    return hashlib.sha256(raw_token.encode()).hexdigest()


def _create_refresh_token(
    user: User,
    *,
    family_id: uuid.UUID | None = None,
    expires_at: datetime | None = None,
) -> str:
    raw_token = secrets.token_urlsafe(64)
    RefreshToken.objects.create(
        token_hash=_hash_refresh_token(raw_token),
        user=user,
        family_id=family_id or uuid.uuid4(),
        expires_at=expires_at
        or timezone.now() + timedelta(seconds=REFRESH_TOKEN_MAX_AGE),
    )
    return raw_token


def _get_refresh_token(raw_token: str) -> RefreshToken | None:
    if not raw_token:
        return None
    try:
        return (
            RefreshToken.objects.select_for_update()
            .select_related("user")
            .get(pk=_hash_refresh_token(raw_token))
        )
    except RefreshToken.DoesNotExist:
        return None


def issue_token_pair(user: User) -> TokenPair:
    raw_refresh_token = _create_refresh_token(user)
    return TokenPair(_make_access_token(str(user.id)), raw_refresh_token)


def revoke_refresh_token(raw_token: str) -> None:
    with transaction.atomic():
        refresh_token = _get_refresh_token(raw_token)
        if refresh_token is not None:
            RefreshToken.objects.filter(
                family_id=refresh_token.family_id, revoked_at__isnull=True
            ).update(revoked_at=timezone.now())


def rotate_refresh_token(raw_token: str) -> TokenPair:
    with transaction.atomic():
        current_token = _get_refresh_token(raw_token)
        if current_token is not None:
            now = timezone.now()
            if current_token.revoked_at is not None:
                RefreshToken.objects.filter(
                    family_id=current_token.family_id, revoked_at__isnull=True
                ).update(revoked_at=now)
            elif current_token.expires_at <= now or not current_token.user.is_active:
                current_token.revoked_at = now
                current_token.save(update_fields=["revoked_at"])
            else:
                refresh_token = _create_refresh_token(
                    current_token.user,
                    family_id=current_token.family_id,
                    expires_at=current_token.expires_at,
                )
                current_token.revoked_at = now
                current_token.save(update_fields=["revoked_at"])
                return TokenPair(
                    _make_access_token(str(current_token.user.id)), refresh_token
                )

    raise InvalidRefreshTokenError
