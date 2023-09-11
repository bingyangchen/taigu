from django.contrib.auth.hashers import check_password
from django.contrib.auth.password_validation import validate_password
from django.core.validators import validate_email

from main.exceptions import (
    DataNotSufficientError,
    DuplicatedEmailError,
    WrongPasswordError,
)

from .models import User


def validate_registration_info(
    username: str | None, email: str | None, password: str | None
) -> None:
    if not (username and email and password):
        raise DataNotSufficientError

    validate_email(email)

    if User.objects.filter(email=email).first():
        raise DuplicatedEmailError

    validate_password(password)


def update_user(**kwargs) -> User:
    id = kwargs.get("id")
    username = kwargs.get("username")
    email = kwargs.get("email")
    avatar_url = kwargs.get("avatar_url")
    old_password = kwargs.get("old_password")
    new_password = kwargs.get("new_password")

    if id is None:
        raise DataNotSufficientError
    else:
        user: User = User.objects.get(pk=id)
        if username or (username == ""):
            user.username = username

        if email:
            if (u2 := User.objects.filter(email=email).first()) and u2 != user:
                raise DuplicatedEmailError
            validate_email(email)
            user.email = email

        if avatar_url:
            user.avatar_url = avatar_url
        elif avatar_url == "":
            user.avatar_url = None

        if new_password and old_password:
            if check_password(old_password, user.password):
                validate_password(new_password)
                user.set_password(new_password)
            else:
                raise WrongPasswordError
        elif old_password or new_password:
            raise DataNotSufficientError

        user.save()
        return user
