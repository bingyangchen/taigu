import uuid

from django.contrib.auth.models import AbstractUser, BaseUserManager
from django.db import models

from main.account import OAuthOrganization


class UserManager(BaseUserManager):
    def create_user(
        self,
        oauth_org: str,
        oauth_id: str,
        email: str,
        is_staff: bool = False,
        is_superuser: bool = False,
        **extra_fields,  # noqa: ANN003
    ) -> "User":
        # `normalize_email` is a class method
        email = UserManager.normalize_email(email)
        user = self.model(
            oauth_org=oauth_org,
            oauth_id=oauth_id,
            email=email,
            is_staff=is_staff,
            is_superuser=is_superuser,
            **extra_fields,
        )
        user.save()
        return user

    def create_superuser(
        self,
        oauth_org: str,
        oauth_id: str,
        email: str,
        **extra_fields,  # noqa: ANN003
    ) -> "User":
        return self.create_user(oauth_org, oauth_id, email, True, True, **extra_fields)


class User(AbstractUser):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    oauth_org = models.CharField(max_length=8, choices=OAuthOrganization.CHOICES)
    oauth_id = models.CharField(max_length=64, db_index=True)
    email = models.EmailField(max_length=256, unique=True)
    username = models.CharField(max_length=64, unique=False)
    avatar_url = models.CharField(max_length=2048, blank=True, null=True)
    is_active = models.BooleanField(default=True)

    # Remove default attributes of AbstracUser
    first_name = None
    last_name = None

    objects = UserManager()

    # Implementation of AbstractUser
    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["oauth_org", "oauth_id", "username"]

    class Meta:
        db_table = "user"
        unique_together = [["oauth_org", "oauth_id"]]

    def __str__(self) -> str:
        return self.username
