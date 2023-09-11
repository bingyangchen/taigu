from django.contrib.auth.backends import BaseBackend
from django.contrib.auth.hashers import check_password
from rest_framework.authtoken.models import Token

from main.exceptions import WrongPasswordError

from .models import User


class MyBackend(BaseBackend):
    def authenticate(
        self,
        request,
        token: str | None = None,
        email: str | None = None,
        password: str | None = None,
    ) -> User | None:
        if token:
            try:
                return Token.objects.get(pk=token).user
            except Token.DoesNotExist:
                return None
        elif email and password:
            try:
                user: User = User.objects.get(email=email)
            except User.DoesNotExist:
                raise User.DoesNotExist("User Does Not Exist")
            if check_password(password, user.password):
                return user
            else:
                raise WrongPasswordError
        return None
