from contextlib import suppress
from datetime import datetime

from django.conf import settings
from django.contrib.auth.backends import BaseBackend
from django.http import HttpRequest
from jose import jwt
from jose.constants import ALGORITHMS

from main.account.models import User


class MyBackend(BaseBackend):
    def authenticate(self, request: HttpRequest, token: str) -> User | None:
        user: User | None = None
        with suppress(Exception):
            claims = jwt.decode(
                token, settings.SECRET_KEY, algorithms=[ALGORITHMS.HS256]
            )
            if claims["exp"] > datetime.now().timestamp():
                # TODO: read from cache
                db_user: User = User.objects.get(pk=claims["id"], is_active=True)
                user = db_user
        request.user = user  # type: ignore
        return user
