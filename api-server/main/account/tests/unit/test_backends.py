from datetime import datetime, timedelta

import pytest
from django.conf import settings
from django.http import HttpRequest
from jose import jwt
from jose.constants import ALGORITHMS

from main.account import OAuthOrganization
from main.account.backends import MyBackend
from main.account.models import User


@pytest.mark.django_db
class TestMyBackend:
    @pytest.fixture
    def backend(self) -> MyBackend:
        return MyBackend()

    @pytest.fixture
    def request_obj(self) -> HttpRequest:
        return HttpRequest()

    @pytest.fixture
    def user(self) -> User:
        return User.objects.create_user(
            oauth_org=OAuthOrganization.GOOGLE,
            oauth_id="test_oauth_id",
            email="test@example.com",
            username="Test User",
        )

    def test_authenticate_valid_token_success(
        self, backend: MyBackend, request_obj: HttpRequest, user: User
    ) -> None:
        # Create a valid JWT token
        payload = {
            "id": str(user.id),
            "exp": int((datetime.now() + timedelta(days=30)).timestamp()),
        }
        token = jwt.encode(payload, settings.SECRET_KEY, algorithm=ALGORITHMS.HS256)

        authenticated_user = backend.authenticate(request_obj, token)

        assert authenticated_user == user

    def test_authenticate_expired_token(
        self, backend: MyBackend, request_obj: HttpRequest, user: User
    ) -> None:
        # Create an expired JWT token
        payload = {
            "id": str(user.id),
            "exp": int((datetime.now() - timedelta(days=1)).timestamp()),
        }
        token = jwt.encode(payload, settings.SECRET_KEY, algorithm=ALGORITHMS.HS256)

        authenticated_user = backend.authenticate(request_obj, token)

        assert authenticated_user is None

    def test_authenticate_invalid_token_format(
        self, backend: MyBackend, request_obj: HttpRequest
    ) -> None:
        token = "invalid_token_format"  # noqa: S105

        authenticated_user = backend.authenticate(request_obj, token)

        assert authenticated_user is None

    def test_authenticate_wrong_secret_key(
        self, backend: MyBackend, request_obj: HttpRequest, user: User
    ) -> None:
        payload = {
            "id": str(user.id),
            "exp": int((datetime.now() + timedelta(days=30)).timestamp()),
        }
        token = jwt.encode(payload, "wrong_secret_key", algorithm=ALGORITHMS.HS256)

        authenticated_user = backend.authenticate(request_obj, token)

        assert authenticated_user is None

    def test_authenticate_missing_user_id(
        self, backend: MyBackend, request_obj: HttpRequest, user: User
    ) -> None:
        payload = {"exp": int((datetime.now() + timedelta(days=30)).timestamp())}
        token = jwt.encode(payload, settings.SECRET_KEY, algorithm=ALGORITHMS.HS256)

        authenticated_user = backend.authenticate(request_obj, token)

        assert authenticated_user is None

    def test_authenticate_missing_exp(
        self, backend: MyBackend, request_obj: HttpRequest, user: User
    ) -> None:
        payload = {"id": str(user.id)}
        token = jwt.encode(payload, settings.SECRET_KEY, algorithm=ALGORITHMS.HS256)

        authenticated_user = backend.authenticate(request_obj, token)

        assert authenticated_user is None

    def test_authenticate_nonexistent_user(
        self, backend: MyBackend, request_obj: HttpRequest
    ) -> None:
        payload = {
            "id": "00000000-0000-0000-0000-000000000000",
            "exp": int((datetime.now() + timedelta(days=30)).timestamp()),
        }
        token = jwt.encode(payload, settings.SECRET_KEY, algorithm=ALGORITHMS.HS256)

        authenticated_user = backend.authenticate(request_obj, token)

        assert authenticated_user is None

    def test_authenticate_user_deactivated(
        self, backend: MyBackend, request_obj: HttpRequest, user: User
    ) -> None:
        User.objects.filter(id=user.id).update(is_active=False)
        user.refresh_from_db()

        payload = {
            "id": str(user.id),
            "exp": int((datetime.now() + timedelta(days=30)).timestamp()),
        }
        token = jwt.encode(payload, settings.SECRET_KEY, algorithm=ALGORITHMS.HS256)

        authenticated_user = backend.authenticate(request_obj, token)

        assert authenticated_user is None
