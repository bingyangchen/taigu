# ruff: noqa: ANN401
import uuid
from typing import Any

import pytest
from django.db import DataError, IntegrityError

from main.account import OAuthOrganization
from main.account.models import User, UserManager


@pytest.mark.django_db
class TestUserManager:
    @pytest.fixture
    def manager(self) -> UserManager:
        manager = UserManager()
        manager.model = User
        return manager

    def test_create_user_success(self, manager: UserManager) -> None:
        user = manager.create_user(
            oauth_org=OAuthOrganization.GOOGLE,
            oauth_id="test_oauth_id",
            email="test@example.com",
        )

        assert isinstance(user, User)
        assert user.oauth_org == OAuthOrganization.GOOGLE
        assert user.oauth_id == "test_oauth_id"
        assert user.email == "test@example.com"
        assert not user.is_staff
        assert not user.is_superuser
        assert user.is_active

    def test_create_user_with_staff_permissions(self, manager: UserManager) -> None:
        user = manager.create_user(
            oauth_org=OAuthOrganization.GOOGLE,
            oauth_id="test_oauth_id",
            email="test@example.com",
            is_staff=True,
        )

        assert user.is_staff
        assert not user.is_superuser

    def test_create_user_with_superuser_permissions(self, manager: UserManager) -> None:
        user = manager.create_user(
            oauth_org=OAuthOrganization.GOOGLE,
            oauth_id="test_oauth_id",
            email="test@example.com",
            is_superuser=True,
        )

        assert user.is_superuser
        assert not user.is_staff

    def test_create_user_with_extra_fields(self, manager: UserManager) -> None:
        user = manager.create_user(
            oauth_org=OAuthOrganization.GOOGLE,
            oauth_id="test_oauth_id",
            email="test@example.com",
            username="testuser",
            avatar_url="https://example.com/avatar.jpg",
        )

        assert user.username == "testuser"
        assert user.avatar_url == "https://example.com/avatar.jpg"

    def test_create_user_email_normalization(self, manager: UserManager) -> None:
        user = manager.create_user(
            oauth_org=OAuthOrganization.GOOGLE,
            oauth_id="test_oauth_id",
            email="TEST@EXAMPLE.COM",
        )

        assert user.email == "TEST@example.com"

    def test_create_superuser_success(self, manager: UserManager) -> None:
        user = manager.create_superuser(
            oauth_org=OAuthOrganization.GOOGLE,
            oauth_id="test_oauth_id",
            email="test@example.com",
        )

        assert isinstance(user, User)
        assert user.is_staff
        assert user.is_superuser
        assert user.is_active

    def test_create_superuser_with_extra_fields(self, manager: UserManager) -> None:
        user = manager.create_superuser(
            oauth_org=OAuthOrganization.GOOGLE,
            oauth_id="test_oauth_id",
            email="test@example.com",
            username="adminuser",
            avatar_url="https://example.com/admin.jpg",
        )

        assert user.username == "adminuser"
        assert user.avatar_url == "https://example.com/admin.jpg"


@pytest.mark.django_db
class TestUserModel:
    @pytest.fixture
    def user_data(self) -> dict[str, Any]:
        return {
            "oauth_org": OAuthOrganization.GOOGLE,
            "oauth_id": "test_oauth_id",
            "email": "test@example.com",
            "username": "testuser",
        }

    def test_user_creation(self, user_data: dict[str, Any]) -> None:
        user = User.objects.create_user(**user_data)

        assert isinstance(user.id, uuid.UUID)
        assert user.oauth_org == OAuthOrganization.GOOGLE
        assert user.oauth_id == "test_oauth_id"
        assert user.email == "test@example.com"
        assert user.username == "testuser"
        assert user.is_active
        assert user.avatar_url is None

    def test_user_creation_with_avatar(self, user_data: dict[str, Any]) -> None:
        user_data["avatar_url"] = "https://example.com/avatar.jpg"
        user = User.objects.create_user(**user_data)

        assert user.avatar_url == "https://example.com/avatar.jpg"

    def test_user_str_representation(self, user_data: dict[str, Any]) -> None:
        user = User.objects.create_user(**user_data)

        assert str(user) == "testuser"

    def test_user_meta_options(self) -> None:
        assert User._meta.db_table == "user"
        assert User.USERNAME_FIELD == "email"
        assert User.REQUIRED_FIELDS == ["oauth_org", "oauth_id", "username"]

    def test_user_unique_constraints(self, user_data: dict[str, Any]) -> None:
        User.objects.create_user(**user_data)

        with pytest.raises((IntegrityError, ValueError)):
            User.objects.create_user(**user_data)

    def test_user_email_uniqueness(self, user_data: dict[str, Any]) -> None:
        User.objects.create_user(**user_data)

        user_data2 = user_data.copy()
        user_data2["oauth_id"] = "different_oauth_id"

        with pytest.raises((IntegrityError, ValueError)):
            User.objects.create_user(**user_data2)

    def test_user_oauth_choices(self, user_data: dict[str, Any]) -> None:
        # Test Google
        user_data["oauth_org"] = OAuthOrganization.GOOGLE
        user = User.objects.create_user(**user_data)
        assert user.oauth_org == OAuthOrganization.GOOGLE

        # Test Facebook
        user_data2 = user_data.copy()
        user_data2["oauth_id"] = "facebook_oauth_id"
        user_data2["oauth_org"] = OAuthOrganization.FACEGOOK
        user_data2["email"] = "test2@example.com"  # Use different email
        user2 = User.objects.create_user(**user_data2)
        assert user2.oauth_org == OAuthOrganization.FACEGOOK

    def test_user_is_active_default(self, user_data: dict[str, Any]) -> None:
        user = User.objects.create_user(**user_data)

        assert user.is_active

    def test_user_avatar_url_null_blank(self, user_data: dict[str, Any]) -> None:
        user = User.objects.create_user(**user_data)

        # Test setting to None
        user.avatar_url = None
        user.save()
        user.refresh_from_db()
        assert user.avatar_url is None

        # Test setting to empty string
        user.avatar_url = ""
        user.save()
        user.refresh_from_db()
        assert user.avatar_url == ""

    def test_user_oauth_id_max_length(self, user_data: dict[str, Any]) -> None:
        user_data["oauth_id"] = "a" * 65  # Exceeds max_length=64

        with pytest.raises((IntegrityError, ValueError, DataError)):
            User.objects.create_user(**user_data)

    def test_user_email_max_length(self, user_data: dict[str, Any]) -> None:
        user_data["email"] = "a" * 250 + "@example.com"  # Exceeds max_length=256

        with pytest.raises((IntegrityError, ValueError, DataError)):
            User.objects.create_user(**user_data)

    def test_user_username_max_length(self, user_data: dict[str, Any]) -> None:
        user_data["username"] = "a" * 65  # Exceeds max_length=64

        with pytest.raises((IntegrityError, ValueError, DataError)):
            User.objects.create_user(**user_data)

    def test_user_avatar_url_max_length(self, user_data: dict[str, Any]) -> None:
        user_data["avatar_url"] = "a" * 2049  # Exceeds max_length=2048

        with pytest.raises((IntegrityError, ValueError, DataError)):
            User.objects.create_user(**user_data)

    def test_user_oauth_org_max_length(self, user_data: dict[str, Any]) -> None:
        user_data["oauth_org"] = "toolonger"  # Exceeds max_length=8

        with pytest.raises((IntegrityError, ValueError, DataError)):
            User.objects.create_user(**user_data)

    def test_user_get_or_create(self) -> None:
        user, created = User.objects.get_or_create(
            oauth_org=OAuthOrganization.GOOGLE,
            oauth_id="test_oauth_id",
            defaults={
                "email": "test@example.com",
                "username": "testuser",
            },
        )

        assert created
        assert isinstance(user, User)
        assert user.oauth_org == OAuthOrganization.GOOGLE
        assert user.oauth_id == "test_oauth_id"

        user2, created2 = User.objects.get_or_create(
            oauth_org=OAuthOrganization.GOOGLE,
            oauth_id="test_oauth_id",
            defaults={
                "email": "different@example.com",
                "username": "differentuser",
            },
        )

        assert not created2
        assert user2.id == user.id
        assert user2.email == user.email  # Should not be updated
