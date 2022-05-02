from django.contrib.auth.backends import BaseBackend
from django.contrib.auth.hashers import check_password

from rest_framework.authtoken.models import Token

from ..account.models import user as User


class MyBackend(BaseBackend):
    def authenticate(self, request, token=None, email=None, password=None):
        if token:
            try:
                t = Token.objects.get(pk=token)
                return User.objects.get(pk=t.user_id)
            except Token.DoesNotExist or User.DoesNotExist:
                return None
        elif email and password:
            try:
                user = User.objects.get(email=email)
                if check_password(password, user.password):
                    return user
                else:
                    raise Exception("wrong-password")
            except User.DoesNotExist:
                raise Exception("user-not-found")
        return None
