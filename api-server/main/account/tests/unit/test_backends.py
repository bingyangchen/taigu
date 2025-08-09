from datetime import datetime, timedelta

import pytest
from django.conf import settings
from django.contrib.auth import authenticate
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
        assert request_obj.user == user

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
        assert request_obj.user is None

    def test_authenticate_invalid_token_format(
        self, backend: MyBackend, request_obj: HttpRequest
    ) -> None:
        token = "invalid_token_format"  # noqa: S105

        authenticated_user = backend.authenticate(request_obj, token)

        assert authenticated_user is None
        assert request_obj.user is None

    def test_authenticate_malformed_token(
        self, backend: MyBackend, request_obj: HttpRequest
    ) -> None:
        token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid.signature"  # noqa: S105

        authenticated_user = backend.authenticate(request_obj, token)

        assert authenticated_user is None
        assert request_obj.user is None

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
        assert request_obj.user is None

    def test_authenticate_missing_user_id(
        self, backend: MyBackend, request_obj: HttpRequest, user: User
    ) -> None:
        payload = {"exp": int((datetime.now() + timedelta(days=30)).timestamp())}
        token = jwt.encode(payload, settings.SECRET_KEY, algorithm=ALGORITHMS.HS256)

        authenticated_user = backend.authenticate(request_obj, token)

        assert authenticated_user is None
        assert request_obj.user is None

    def test_authenticate_missing_exp(
        self, backend: MyBackend, request_obj: HttpRequest, user: User
    ) -> None:
        payload = {"id": str(user.id)}
        token = jwt.encode(payload, settings.SECRET_KEY, algorithm=ALGORITHMS.HS256)

        authenticated_user = backend.authenticate(request_obj, token)

        assert authenticated_user is None
        assert request_obj.user is None

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
        assert request_obj.user is None

    def test_authenticate_none_token(
        self, backend: MyBackend, request_obj: HttpRequest
    ) -> None:
        authenticated_user = backend.authenticate(request_obj, None)

        assert authenticated_user is None
        assert request_obj.user is None

    def test_authenticate_empty_token(
        self, backend: MyBackend, request_obj: HttpRequest
    ) -> None:
        authenticated_user = backend.authenticate(request_obj, "")

        assert authenticated_user is None
        assert request_obj.user is None

    def test_authenticate_with_django_authenticate(
        self, backend: MyBackend, request_obj: HttpRequest, user: User
    ) -> None:
        payload = {
            "id": str(user.id),
            "exp": int((datetime.now() + timedelta(days=30)).timestamp()),
        }
        token = jwt.encode(payload, settings.SECRET_KEY, algorithm=ALGORITHMS.HS256)

        authenticated_user = authenticate(request_obj, token=token)

        assert authenticated_user == user
        assert request_obj.user == user

    def test_authenticate_token_with_extra_fields(
        self, backend: MyBackend, request_obj: HttpRequest, user: User
    ) -> None:
        payload = {
            "id": str(user.id),
            "oauth_id": user.oauth_id,
            "iat": int(datetime.now().timestamp()),
            "exp": int((datetime.now() + timedelta(days=30)).timestamp()),
            "extra_field": "extra_value",
        }
        token = jwt.encode(payload, settings.SECRET_KEY, algorithm=ALGORITHMS.HS256)

        authenticated_user = backend.authenticate(request_obj, token)

        assert authenticated_user == user
        assert request_obj.user == user

    def test_authenticate_token_expiring_soon(
        self, backend: MyBackend, request_obj: HttpRequest, user: User
    ) -> None:
        payload = {
            "id": str(user.id),
            "exp": int((datetime.now() + timedelta(seconds=1)).timestamp()),
        }
        token = jwt.encode(payload, settings.SECRET_KEY, algorithm=ALGORITHMS.HS256)

        authenticated_user = backend.authenticate(request_obj, token)

        assert authenticated_user == user
        assert request_obj.user == user

    def test_authenticate_token_expired_by_seconds(
        self, backend: MyBackend, request_obj: HttpRequest, user: User
    ) -> None:
        payload = {
            "id": str(user.id),
            "exp": int((datetime.now() - timedelta(seconds=1)).timestamp()),
        }
        token = jwt.encode(payload, settings.SECRET_KEY, algorithm=ALGORITHMS.HS256)

        authenticated_user = backend.authenticate(request_obj, token)

        assert authenticated_user is None
        assert request_obj.user is None

    def test_authenticate_user_deactivated(
        self, backend: MyBackend, request_obj: HttpRequest, user: User
    ) -> None:
        user.is_active = False
        user.save()

        payload = {
            "id": str(user.id),
            "exp": int((datetime.now() + timedelta(days=30)).timestamp()),
        }
        token = jwt.encode(payload, settings.SECRET_KEY, algorithm=ALGORITHMS.HS256)

        authenticated_user = backend.authenticate(request_obj, token)

        assert authenticated_user is None
        assert request_obj.user is None

    def test_authenticate_invalid_uuid_format(
        self, backend: MyBackend, request_obj: HttpRequest, user: User
    ) -> None:
        payload = {
            "id": "invalid-uuid-format",
            "exp": int((datetime.now() + timedelta(days=30)).timestamp()),
        }
        token = jwt.encode(payload, settings.SECRET_KEY, algorithm=ALGORITHMS.HS256)

        authenticated_user = backend.authenticate(request_obj, token)

        assert authenticated_user is None
        assert request_obj.user is None
