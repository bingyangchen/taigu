from datetime import datetime
from typing import Any

import pytest
from django.db import DataError, IntegrityError

from main.account import OAuthOrganization
from main.account.models import User
from main.memo.models import Favorite, StockMemo, TradePlan
from main.stock.models import Company


@pytest.mark.django_db
class TestStockMemoModel:
    @pytest.fixture
    def user(self) -> User:
        return User.objects.create_user(
            oauth_org=OAuthOrganization.GOOGLE,
            oauth_id="test_oauth_id",
            email="test@example.com",
            username="testuser",
        )

    @pytest.fixture
    def company(self) -> Company:
        return Company.objects.create(stock_id="2330", name="Taiwan Semiconductor")

    @pytest.fixture
    def stock_memo_data(self, user: User, company: Company) -> dict[str, Any]:
        return {"owner": user, "company": company, "note": "This is a test memo"}

    def test_stock_memo_creation(self, stock_memo_data: dict[str, Any]) -> None:
        memo = StockMemo.objects.create(**stock_memo_data)

        assert memo.owner == stock_memo_data["owner"]
        assert memo.company == stock_memo_data["company"]
        assert memo.note == stock_memo_data["note"]
        assert isinstance(memo.created_at, datetime)
        assert isinstance(memo.updated_at, datetime)

    def test_stock_memo_creation_with_empty_note(
        self, user: User, company: Company
    ) -> None:
        memo = StockMemo.objects.create(owner=user, company=company, note="")
        assert memo.note == ""

    def test_stock_memo_str_representation(
        self, stock_memo_data: dict[str, Any]
    ) -> None:
        memo = StockMemo.objects.create(**stock_memo_data)
        expected_str = f"{memo.owner.username}_{memo.company.pk}"
        assert str(memo) == expected_str

    def test_stock_memo_meta_options(self) -> None:
        assert StockMemo._meta.db_table == "stock_memo"
        assert ("owner", "company") in StockMemo._meta.unique_together

    def test_stock_memo_unique_constraint(self, user: User, company: Company) -> None:
        # Create first memo
        StockMemo.objects.create(owner=user, company=company, note="First memo")

        # Try to create second memo with same owner and company
        with pytest.raises((IntegrityError, ValueError)):
            StockMemo.objects.create(owner=user, company=company, note="Second memo")

    def test_stock_memo_foreign_key_relationships(
        self, user: User, company: Company
    ) -> None:
        memo = StockMemo.objects.create(owner=user, company=company, note="Test")

        # Test forward relationships
        assert memo.owner == user
        assert memo.company == company

        # Test reverse relationships
        assert memo in user.stock_memos.all()

    def test_stock_memo_cascade_on_user_delete(
        self, user: User, company: Company
    ) -> None:
        memo = StockMemo.objects.create(owner=user, company=company, note="Test")
        memo_id = memo.id

        user.delete()

        assert not StockMemo.objects.filter(id=memo_id).exists()

    def test_stock_memo_protect_on_company_delete(
        self, user: User, company: Company
    ) -> None:
        StockMemo.objects.create(owner=user, company=company, note="Test")

        with pytest.raises(IntegrityError):
            company.delete()


@pytest.mark.django_db
class TestTradePlanModel:
    @pytest.fixture
    def user(self) -> User:
        return User.objects.create_user(
            oauth_org=OAuthOrganization.GOOGLE,
            oauth_id="test_oauth_id",
            email="test@example.com",
            username="testuser",
        )

    @pytest.fixture
    def company(self) -> Company:
        return Company.objects.create(stock_id="2330", name="Taiwan Semiconductor")

    @pytest.fixture
    def trade_plan_data(self, user: User, company: Company) -> dict[str, Any]:
        return {
            "owner": user,
            "company": company,
            "plan_type": "BUY",
            "target_price": 550.0,
            "target_quantity": 1000,
        }

    def test_trade_plan_creation(self, trade_plan_data: dict[str, Any]) -> None:
        plan = TradePlan.objects.create(**trade_plan_data)

        assert plan.owner == trade_plan_data["owner"]
        assert plan.company == trade_plan_data["company"]
        assert plan.plan_type == trade_plan_data["plan_type"]
        assert plan.target_price == trade_plan_data["target_price"]
        assert plan.target_quantity == trade_plan_data["target_quantity"]
        assert isinstance(plan.created_at, datetime)
        assert isinstance(plan.updated_at, datetime)

    def test_trade_plan_str_representation(
        self, trade_plan_data: dict[str, Any]
    ) -> None:
        plan = TradePlan.objects.create(**trade_plan_data)

        expected_str = f"{plan.owner.username}_{plan.company.pk}_${plan.target_price}_{plan.plan_type}_{plan.target_quantity}"
        assert str(plan) == expected_str

    def test_trade_plan_meta_options(self) -> None:
        assert TradePlan._meta.db_table == "trade_plan"

    def test_trade_plan_foreign_key_relationships(
        self, user: User, company: Company
    ) -> None:
        plan = TradePlan.objects.create(
            owner=user,
            company=company,
            plan_type="SELL",
            target_price=600.0,
            target_quantity=500,
        )

        # Test forward relationships
        assert plan.owner == user
        assert plan.company == company

        # Test reverse relationships
        assert plan in user.trade_plans.all()

    def test_trade_plan_cascade_on_user_delete(
        self, user: User, company: Company
    ) -> None:
        plan = TradePlan.objects.create(
            owner=user,
            company=company,
            plan_type="BUY",
            target_price=550.0,
            target_quantity=1000,
        )
        plan_id = plan.id

        user.delete()

        assert not TradePlan.objects.filter(id=plan_id).exists()

    def test_trade_plan_protect_on_company_delete(
        self, user: User, company: Company
    ) -> None:
        TradePlan.objects.create(
            owner=user,
            company=company,
            plan_type="BUY",
            target_price=550.0,
            target_quantity=1000,
        )

        with pytest.raises(IntegrityError):
            company.delete()

    def test_trade_plan_multiple_plans_per_user_company(
        self, user: User, company: Company
    ) -> None:
        # Unlike StockMemo, TradePlan doesn't have unique_together constraint
        plan1 = TradePlan.objects.create(
            owner=user,
            company=company,
            plan_type="BUY",
            target_price=550.0,
            target_quantity=1000,
        )
        plan2 = TradePlan.objects.create(
            owner=user,
            company=company,
            plan_type="SELL",
            target_price=600.0,
            target_quantity=500,
        )

        assert plan1.id != plan2.id
        assert TradePlan.objects.filter(owner=user, company=company).count() == 2

    def test_trade_plan_plan_type_max_length_validation(
        self, user: User, company: Company
    ) -> None:
        long_plan_type = "A" * 33  # Exceeds max_length=32

        with pytest.raises((IntegrityError, ValueError, DataError)):
            TradePlan.objects.create(
                owner=user,
                company=company,
                plan_type=long_plan_type,
                target_price=550.0,
                target_quantity=1000,
            )


@pytest.mark.django_db
class TestFavoriteModel:
    @pytest.fixture
    def user(self) -> User:
        return User.objects.create_user(
            oauth_org=OAuthOrganization.GOOGLE,
            oauth_id="test_oauth_id",
            email="test@example.com",
            username="testuser",
        )

    @pytest.fixture
    def company(self) -> Company:
        return Company.objects.create(stock_id="2330", name="Taiwan Semiconductor")

    @pytest.fixture
    def favorite_data(self, user: User, company: Company) -> dict[str, Any]:
        return {
            "owner": user,
            "company": company,
        }

    def test_favorite_creation(self, favorite_data: dict[str, Any]) -> None:
        favorite = Favorite.objects.create(**favorite_data)

        assert favorite.owner == favorite_data["owner"]
        assert favorite.company == favorite_data["company"]
        assert isinstance(favorite.created_at, datetime)
        assert isinstance(favorite.updated_at, datetime)

    def test_favorite_str_representation(self, favorite_data: dict[str, Any]) -> None:
        favorite = Favorite.objects.create(**favorite_data)

        expected_str = f"{favorite.owner.username}_{favorite.company.pk}"
        assert str(favorite) == expected_str

    def test_favorite_meta_options(self) -> None:
        assert Favorite._meta.db_table == "favorite"
        assert ("owner", "company") in Favorite._meta.unique_together

    def test_favorite_unique_constraint(self, user: User, company: Company) -> None:
        # Create first favorite
        Favorite.objects.create(owner=user, company=company)

        # Try to create second favorite with same owner and company
        with pytest.raises((IntegrityError, ValueError)):
            Favorite.objects.create(owner=user, company=company)

    def test_favorite_foreign_key_relationships(
        self, user: User, company: Company
    ) -> None:
        favorite = Favorite.objects.create(owner=user, company=company)

        # Test forward relationships
        assert favorite.owner == user
        assert favorite.company == company

        # Test reverse relationships
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

        with pytest.raises(IntegrityError):
            company.delete()

    def test_favorite_multiple_users_same_company(self, company: Company) -> None:
        user1 = User.objects.create_user(
            oauth_org=OAuthOrganization.GOOGLE,
            oauth_id="user1_oauth_id",
            email="user1@example.com",
            username="user1",
        )
        user2 = User.objects.create_user(
            oauth_org=OAuthOrganization.GOOGLE,
            oauth_id="user2_oauth_id",
            email="user2@example.com",
            username="user2",
        )

        favorite1 = Favorite.objects.create(owner=user1, company=company)
        favorite2 = Favorite.objects.create(owner=user2, company=company)

        assert favorite1.id != favorite2.id
        assert Favorite.objects.filter(company=company).count() == 2
