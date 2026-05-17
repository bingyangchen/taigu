import json

import pytest
from django.core.exceptions import ObjectDoesNotExist
from django.http import HttpRequest
from django.test import RequestFactory

from main.account.models import User
from main.favorite.models import Favorite
from main.favorite.views import (
    _create_favorite,
    _delete_favorite,
    create_or_delete_favorite,
    list_favorites,
)
from main.market.models import Company


@pytest.mark.django_db
class TestFavoriteViews:
    @pytest.fixture
    def user(self) -> User:
        return User.objects.create(
            oauth_org="google",
            oauth_id="test_user",
            email="test@example.com",
            username="testuser",
        )

    @pytest.fixture
    def company(self) -> Company:
        return Company.objects.create(
            stock_id="2330", name="台積電", trade_type="tse", business="Semiconductor"
        )

    @pytest.fixture
    def request_obj(self, user: User) -> HttpRequest:
        request = RequestFactory().post("/")
        request.user = user  # type: ignore
        return request

    def test_create_or_delete_favorite_post_method(
        self, request_obj: HttpRequest, company: Company
    ) -> None:
        response = create_or_delete_favorite(request_obj, company.pk)

        assert response.status_code == 200
        assert Favorite.objects.filter(owner=request_obj.user, company=company).exists()

    def test_create_or_delete_favorite_delete_method(
        self, user: User, company: Company
    ) -> None:
        Favorite.objects.create(owner=user, company=company)
        request = RequestFactory().delete("/")
        request.user = user  # type: ignore

        response = create_or_delete_favorite(request, company.pk)

        assert response.status_code == 200
        assert not Favorite.objects.filter(owner=user, company=company).exists()

    def test_create_favorite_is_idempotent(
        self, request_obj: HttpRequest, company: Company
    ) -> None:
        Favorite.objects.create(owner=request_obj.user, company=company)

        response = _create_favorite(request_obj, company.pk)

        assert response.status_code == 200
        assert (
            Favorite.objects.filter(owner=request_obj.user, company=company).count()
            == 1
        )

    def test_create_favorite_unknown_company(self, request_obj: HttpRequest) -> None:
        with pytest.raises(ObjectDoesNotExist):
            _create_favorite(request_obj, "unknown_sid")

    def test_delete_favorite_success(
        self, request_obj: HttpRequest, company: Company
    ) -> None:
        Favorite.objects.create(owner=request_obj.user, company=company)

        response = _delete_favorite(request_obj, company.pk)
        data = json.loads(response.content)

        assert response.status_code == 200
        assert data["sid"] == company.pk
        assert not Favorite.objects.filter(
            owner=request_obj.user, company=company
        ).exists()

    def test_delete_favorite_not_found(
        self, request_obj: HttpRequest, company: Company
    ) -> None:
        with pytest.raises(ObjectDoesNotExist):
            _delete_favorite(request_obj, company.pk)

    def test_list_favorites_success(self, user: User, company: Company) -> None:
        Favorite.objects.create(owner=user, company=company)
        request = RequestFactory().get("/")
        request.user = user  # type: ignore

        response = list_favorites(request)
        data = json.loads(response.content)

        assert response.status_code == 200
        assert data["data"] == [company.pk]
