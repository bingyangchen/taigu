from contextlib import suppress
from datetime import datetime

from django.conf import settings
from django.contrib.auth.backends import BaseBackend
from django.http import HttpRequest
from jose import jwt
from jose.constants import ALGORITHMS

from .models import User


class MyBackend(BaseBackend):
    def authenticate(self, request: HttpRequest, token: str) -> User | None:  # type: ignore
        user = None
        with suppress(Exception):
            d = jwt.decode(token, settings.SECRET_KEY, algorithms=[ALGORITHMS.HS256])
            if (
                d["exp"] > datetime.now().timestamp()
                and d["oauth_id"] == (u := User.objects.get(pk=d["id"])).oauth_id
            ):
                user = u
        request.user = user  # type: ignore
        return user
