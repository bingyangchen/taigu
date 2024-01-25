from django.contrib.auth.backends import BaseBackend
from rest_framework.authtoken.models import Token

from .models import User


class MyBackend(BaseBackend):
    def authenticate(self, request, token: str) -> User | None:
        try:
            return Token.objects.get(pk=token).user
        except Token.DoesNotExist:
            return None
