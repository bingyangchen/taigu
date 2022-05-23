from django.contrib.auth.password_validation import validate_password
from django.core.validators import validate_email

from .models import user as User


def validate_registration_info(request):
    username = request.POST.get("username")
    email = request.POST.get("email")
    password = request.POST.get("password")

    validate_email(email)
    validate_password(password)

    if not (username and email and password):
        raise Exception("Please complete the form.")
    elif len(User.objects.filter(email=email)) > 0:
        raise Exception("Duplicated email.")


def validate_update_info(**kwargs):
    id = kwargs.get("id")
    username = kwargs.get("username")
    email = kwargs.get("email")
    password = kwargs.get("password")

    if id == None:
        raise Exception("Please provide id.")
    else:
        u = User.objects.get(pk=id)
        if username:
            u.username = username
        if email:
            if len(User.objects.filter(email=email)) > 1:
                raise Exception("Duplicated email.")
            validate_email(email)
            u.email = email
        if password:
            validate_password(password)
            u.password = password
        u.save()
