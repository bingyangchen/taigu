from io import StringIO

import pytest
from django.core.management import CommandError, call_command
from django.test import Client

from main.account import ACCESS_COOKIE_NAME, OAuthOrganization
from main.account.models import User
from main.account.services.tokens import issue_token_pair


def _run_command(*args: str) -> str:
    stdout = StringIO()
    call_command("superuser", *args, stdout=stdout)
    return stdout.getvalue()


def _create_user(email: str, *, is_superuser: bool = False) -> User:
    return User.objects.create_user(
        oauth_org=OAuthOrganization.GOOGLE,
        oauth_id=email,
        email=email,
        username=email,
        is_superuser=is_superuser,
    )


def _open_admin_console(user: User) -> int:
    browser = Client()
    browser.cookies[ACCESS_COOKIE_NAME] = issue_token_pair(user).access_token
    return browser.get("/api/admin/usage").status_code


@pytest.mark.django_db
class TestSuperuserCommand:
    @pytest.mark.scenario("ADMIN-R2.1")
    def test_add(self) -> None:
        user = _create_user("dev@example.com")

        _run_command("add", "dev@example.com")

        user.refresh_from_db()
        assert user.is_superuser is True
        assert _open_admin_console(user) == 200

    @pytest.mark.scenario("ADMIN-R2.2")
    def test_remove(self) -> None:
        user = _create_user("dev@example.com", is_superuser=True)

        _run_command("remove", "dev@example.com")

        user.refresh_from_db()
        assert user.is_superuser is False
        assert _open_admin_console(user) == 404

    @pytest.mark.scenario("ADMIN-R2.3")
    def test_unknown_email(self) -> None:
        _create_user("dev@example.com")
        _create_user("ops@example.com", is_superuser=True)

        with pytest.raises(CommandError, match="nobody@example.com"):
            _run_command("add", "nobody@example.com")

        assert list(
            User.objects.order_by("email").values_list("email", "is_superuser")
        ) == [("dev@example.com", False), ("ops@example.com", True)]

    @pytest.mark.scenario("ADMIN-R2.4")
    def test_list(self) -> None:
        _create_user("dev@example.com", is_superuser=True)
        _create_user("ops@example.com", is_superuser=True)
        _create_user("user@example.com")

        output = _run_command("list")

        assert output.split() == ["dev@example.com", "ops@example.com"]
