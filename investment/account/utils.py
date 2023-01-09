from django.contrib.auth.password_validation import validate_password
from django.core.validators import validate_email
from django.contrib.auth.hashers import check_password

from .models import User


def validate_registration_info(username: str, email: str, password: str):
    validate_email(email)
    validate_password(password)

    if not (username and email and password):
        raise Exception("Please complete the form.")
    elif User.objects.filter(email=email).first():
        raise Exception("Duplicated email.")


def update_user(**kwargs):
    id = kwargs.get("id")
    username = kwargs.get("username")
    email = kwargs.get("email")
    avatar_url = kwargs.get("avatar_url")
    old_password = kwargs.get("old_password")
    new_password = kwargs.get("new_password")

    if id == None:
        raise Exception("Please provide id.")
    else:
        u: User = User.objects.get(pk=id)
        if username or (username == ""):
            u.username = username
        if email:
            if (u2 := User.objects.filter(email=email).first()) and u2 != u:
                raise Exception("Duplicated email.")
            validate_email(email)
            u.email = email
        if avatar_url:
            u.avatar_url = avatar_url
        elif avatar_url == "":
            u.avatar_url = None

        if new_password and old_password:
            if check_password(old_password, u.password):
                validate_password(new_password)
                u.set_password(new_password)
            else:
                raise Exception("The original password is wrong.")
        elif old_password:
            raise Exception("Please provide new password.")
        elif new_password:
            raise Exception("Please provide original password.")

        u.save()
        return u
