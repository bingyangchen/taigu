from django.contrib.auth.backends import BaseBackend
from django.contrib.auth.hashers import check_password
from rest_framework.authtoken.models import Token

from .models import User


class MyBackend(BaseBackend):
    def authenticate(self, request, token=None, email=None, password=None):
        if token:
            try:
                t: Token = Token.objects.get(pk=token)
                return User.objects.get(pk=t.user_id)
            except Token.DoesNotExist or User.DoesNotExist:
                return None
        elif email and password:
            try:
                user: User = User.objects.get(email=email)
                if check_password(password, user.password):
                    return user
                else:
                    raise Exception("Wrong Password")
            except User.DoesNotExist:
                raise Exception("User Not Exists")
        return None
