import uuid

from django.contrib.auth.models import AbstractUser, BaseUserManager
from django.db.models import BooleanField, CharField, EmailField, UUIDField

from main.account import OAuthOrganization


class UserManager(BaseUserManager):
    def create_user(
        self,
        oauth_org: str,
        oauth_id: str,
        email: str,
        is_superuser: bool = False,
        **extra_fields,  # noqa: ANN003
    ) -> "User":
        # `normalize_email` is a class method
        email = UserManager.normalize_email(email)
        user = self.model(
            oauth_org=oauth_org,
            oauth_id=oauth_id,
            email=email,
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
        return self.create_user(oauth_org, oauth_id, email, True, **extra_fields)


class User(AbstractUser):
    id = UUIDField(primary_key=True, default=uuid.uuid4)
    oauth_org = CharField(max_length=8, choices=OAuthOrganization.CHOICES)
    oauth_id = CharField(max_length=64)
    email = EmailField(max_length=256, unique=True)
    username = CharField(max_length=64)
    avatar_url = CharField(max_length=2048, blank=True, null=True)
    is_active = BooleanField(db_default=True)  # type: ignore

    # Remove default attributes of AbstracUser
    first_name = None
    last_name = None
    is_staff = None

    objects = UserManager()

    # Implementation of AbstractUser
    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["oauth_org", "oauth_id", "username"]

    class Meta:
        db_table = "user"
        unique_together = [["oauth_org", "oauth_id"]]

    def __str__(self) -> str:
        return str(self.username)
