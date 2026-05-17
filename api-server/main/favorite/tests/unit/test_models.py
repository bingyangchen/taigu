from datetime import datetime
from typing import Any

import pytest
from django.db import IntegrityError
from django.db.models.deletion import ProtectedError

from main.account.models import User
from main.favorite.models import Favorite
from main.market.models import Company


@pytest.mark.django_db
class TestFavoriteModel:
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
    def favorite_data(self, user: User, company: Company) -> dict[str, Any]:
        return {"owner": user, "company": company}

    def test_favorite_creation(self, favorite_data: dict[str, Any]) -> None:
        favorite = Favorite.objects.create(**favorite_data)

        assert favorite.owner == favorite_data["owner"]
        assert favorite.company == favorite_data["company"]
        assert isinstance(favorite.created_at, datetime)
        assert isinstance(favorite.updated_at, datetime)

    def test_favorite_meta_options(self) -> None:
        assert Favorite._meta.app_label == "favorite"
        assert Favorite._meta.db_table == "favorite"
        assert ("owner", "company") in Favorite._meta.unique_together

    def test_favorite_unique_constraint(self, user: User, company: Company) -> None:
        Favorite.objects.create(owner=user, company=company)

        with pytest.raises(IntegrityError):
            Favorite.objects.create(owner=user, company=company)

    def test_favorite_relationships(
        self, user: User, company: Company, favorite_data: dict[str, Any]
    ) -> None:
        favorite = Favorite.objects.create(**favorite_data)

        assert favorite in user.favorites.all()
        assert favorite in company.followers.all()

    def test_favorite_cascade_on_user_delete(
        self, user: User, company: Company
    ) -> None:
        favorite = Favorite.objects.create(owner=user, company=company)
        favorite_id = favorite.id

        user.delete()

        assert not Favorite.objects.filter(id=favorite_id).exists()

    def test_favorite_protect_on_company_delete(
        self, user: User, company: Company
    ) -> None:
        Favorite.objects.create(owner=user, company=company)

        with pytest.raises(ProtectedError):
            company.delete()
