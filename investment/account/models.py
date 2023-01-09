import uuid
import os

from django.db import models
from django.contrib.auth.models import AbstractUser, BaseUserManager


class UserManager(BaseUserManager):
    def create_user(
        self, email, password, is_staff=False, is_superuser=False, **extra_fields
    ):
        # `normalize_email` is a class method
        email = UserManager.normalize_email(email)
        user = self.model(
            email=email, is_staff=is_staff, is_superuser=is_superuser, **extra_fields
        )
        if password:
            user.set_password(password)
        user.save()
        return user

    def create_superuser(self, email, password, **extra_fields):
        return self.create_user(email, password, True, True, **extra_fields)


def user_avatar_path(instance, filename):
    base, extension = os.path.splitext(filename)
    return "user_avatars/{}".format(str(instance.id) + extension)


class User(AbstractUser):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField(max_length=256, unique=True)
    username = models.CharField(max_length=64, unique=False)
    first_name = None  # remove this default column of AbstracUser
    last_name = None  # remove this default column of AbstracUser
    avatar_url = models.CharField(max_length=2048, blank=True, null=True)
    is_active = models.BooleanField(default=True)

    # Deprecated
    avatar = models.ImageField(upload_to=user_avatar_path, blank=True, null=True)

    objects = UserManager()

    # Implementation of AbstractUser
    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["username"]

    class Meta:
        db_table = "user"

    def __str__(self):
        return self.username
