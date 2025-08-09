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

    def test_stock_memo_creation_with_default_note(
        self, user: User, company: Company
    ) -> None:
        memo = StockMemo.objects.create(owner=user, company=company)

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
        assert memo in company.memos.all()

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

    def test_stock_memo_note_field_properties(self) -> None:
        note_field = StockMemo._meta.get_field("note")

        assert hasattr(note_field, "db_default")
        assert note_field.db_default == ""

    def test_stock_memo_owner_field_properties(self) -> None:
        owner_field = StockMemo._meta.get_field("owner")

        assert owner_field.remote_field.related_name == "stock_memos"
        assert owner_field.db_index is True

    def test_stock_memo_company_field_properties(self) -> None:
        company_field = StockMemo._meta.get_field("company")

        assert company_field.remote_field.related_name == "memos"
        assert company_field.db_index is True

    def test_stock_memo_update_preserves_created_at(
        self, user: User, company: Company
    ) -> None:
        memo = StockMemo.objects.create(owner=user, company=company, note="Original")
        original_created_at = memo.created_at

        # Wait a small amount to ensure timestamp difference
        import time

        time.sleep(0.001)

        memo.note = "Updated"
        memo.save()
        memo.refresh_from_db()

        assert memo.created_at == original_created_at
        assert memo.updated_at > original_created_at


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

    def test_trade_plan_field_properties(self) -> None:
        # Test plan_type field
        plan_type_field = TradePlan._meta.get_field("plan_type")
        assert plan_type_field.max_length == 32

        # Test target_price field
        target_price_field = TradePlan._meta.get_field("target_price")
        assert target_price_field.__class__.__name__ == "FloatField"

        # Test target_quantity field
        target_quantity_field = TradePlan._meta.get_field("target_quantity")
        assert target_quantity_field.__class__.__name__ == "BigIntegerField"

    def test_trade_plan_owner_field_properties(self) -> None:
        owner_field = TradePlan._meta.get_field("owner")

        assert owner_field.remote_field.related_name == "trade_plans"
        assert owner_field.db_index is True

    def test_trade_plan_company_field_has_no_related_name(self) -> None:
        company_field = TradePlan._meta.get_field("company")

        # The company field in TradePlan doesn't specify a related_name
        assert (
            not hasattr(company_field, "related_name")
            or company_field.related_name is None
        )

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

    def test_trade_plan_field_type_validation(
        self, user: User, company: Company
    ) -> None:
        # Test string validation for plan_type
        plan = TradePlan.objects.create(
            owner=user,
            company=company,
            plan_type="CUSTOM_TYPE",
            target_price=550.0,
            target_quantity=1000,
        )
        assert plan.plan_type == "CUSTOM_TYPE"

        # Test negative values
        plan_negative = TradePlan.objects.create(
            owner=user,
            company=company,
            plan_type="SELL",
            target_price=-100.0,  # Negative price should be allowed at model level
            target_quantity=-500,  # Negative quantity should be allowed at model level
        )
        assert plan_negative.target_price == -100.0
        assert plan_negative.target_quantity == -500

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

    def test_favorite_owner_field_properties(self) -> None:
        owner_field = Favorite._meta.get_field("owner")

        assert owner_field.remote_field.related_name == "favorites"

    def test_favorite_company_field_properties(self) -> None:
        company_field = Favorite._meta.get_field("company")

        assert company_field.remote_field.related_name == "followers"
        assert company_field.db_index is True

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

    def test_favorite_multiple_companies_same_user(self, user: User) -> None:
        company1 = Company.objects.create(stock_id="2330", name="TSMC")
        company2 = Company.objects.create(stock_id="2317", name="Hon Hai")

        favorite1 = Favorite.objects.create(owner=user, company=company1)
        favorite2 = Favorite.objects.create(owner=user, company=company2)

        assert favorite1.id != favorite2.id
        assert Favorite.objects.filter(owner=user).count() == 2

    def test_favorite_get_or_create_pattern(self, user: User, company: Company) -> None:
        # Test get_or_create pattern which might be used in views
        favorite1, created1 = Favorite.objects.get_or_create(
            owner=user, company=company
        )
        assert created1

        favorite2, created2 = Favorite.objects.get_or_create(
            owner=user, company=company
        )
        assert not created2
        assert favorite1.id == favorite2.id

    def test_favorite_update_preserves_created_at(
        self, user: User, company: Company
    ) -> None:
        favorite = Favorite.objects.create(owner=user, company=company)
        original_created_at = favorite.created_at

        # Wait a small amount to ensure timestamp difference
        import time

        time.sleep(0.001)

        # Since Favorite doesn't have other editable fields, just trigger a save
        favorite.save()
        favorite.refresh_from_db()

        assert favorite.created_at == original_created_at
        assert favorite.updated_at >= original_created_at


@pytest.mark.django_db
class TestMemoModelsIntegration:
    """Integration tests that test relationships between different memo models."""

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

    def test_user_can_have_all_memo_types(self, user: User, company: Company) -> None:
        memo = StockMemo.objects.create(owner=user, company=company, note="Test memo")
        plan = TradePlan.objects.create(
            owner=user,
            company=company,
            plan_type="BUY",
            target_price=550.0,
            target_quantity=1000,
        )
        favorite = Favorite.objects.create(owner=user, company=company)

        # Verify user has all relationships
        assert memo in user.stock_memos.all()
        assert plan in user.trade_plans.all()
        assert favorite in user.favorites.all()

    def test_company_can_have_all_memo_types(
        self, user: User, company: Company
    ) -> None:
        memo = StockMemo.objects.create(owner=user, company=company, note="Test memo")
        TradePlan.objects.create(
            owner=user,
            company=company,
            plan_type="BUY",
            target_price=550.0,
            target_quantity=1000,
        )
        favorite = Favorite.objects.create(owner=user, company=company)

        # Verify company has memo and favorite relationships
        assert memo in company.memos.all()
        assert favorite in company.followers.all()

    def test_memo_models_inherit_from_create_update_date_model(self) -> None:
        # Verify all models have timestamp fields
        memo_fields = [field.name for field in StockMemo._meta.fields]
        plan_fields = [field.name for field in TradePlan._meta.fields]
        favorite_fields = [field.name for field in Favorite._meta.fields]

        for fields in [memo_fields, plan_fields, favorite_fields]:
            assert "created_at" in fields
            assert "updated_at" in fields

    def test_memo_models_cascade_behavior_consistency(self, user: User) -> None:
        company1 = Company.objects.create(stock_id="2330", name="TSMC")
        company2 = Company.objects.create(stock_id="2317", name="Hon Hai")

        # Create all memo types for both companies
        StockMemo.objects.create(owner=user, company=company1, note="TSMC memo")
        StockMemo.objects.create(owner=user, company=company2, note="Hon Hai memo")

        TradePlan.objects.create(
            owner=user,
            company=company1,
            plan_type="BUY",
            target_price=550.0,
            target_quantity=1000,
        )
        TradePlan.objects.create(
            owner=user,
            company=company2,
            plan_type="SELL",
            target_price=100.0,
            target_quantity=500,
        )

        Favorite.objects.create(owner=user, company=company1)
        Favorite.objects.create(owner=user, company=company2)

        # Verify counts before deletion
        assert StockMemo.objects.filter(owner=user).count() == 2
        assert TradePlan.objects.filter(owner=user).count() == 2
        assert Favorite.objects.filter(owner=user).count() == 2

        # Delete user - all memo objects should cascade delete
        user.delete()

        assert StockMemo.objects.count() == 0
        assert TradePlan.objects.count() == 0
        assert Favorite.objects.count() == 0

    def test_different_users_can_have_same_company_memos(
        self, company: Company
    ) -> None:
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

        memo1 = StockMemo.objects.create(
            owner=user1, company=company, note="User1 memo"
        )
        memo2 = StockMemo.objects.create(
            owner=user2, company=company, note="User2 memo"
        )

        plan1 = TradePlan.objects.create(
            owner=user1,
            company=company,
            plan_type="BUY",
            target_price=550.0,
            target_quantity=1000,
        )
        plan2 = TradePlan.objects.create(
            owner=user2,
            company=company,
            plan_type="SELL",
            target_price=600.0,
            target_quantity=500,
        )

        favorite1 = Favorite.objects.create(owner=user1, company=company)
        favorite2 = Favorite.objects.create(owner=user2, company=company)

        assert memo1 != memo2
        assert plan1 != plan2
        assert favorite1 != favorite2

        # Each user should have their own memo
        assert StockMemo.objects.filter(owner=user1).count() == 1
        assert StockMemo.objects.filter(owner=user2).count() == 1

        # Company should have memos from both users
        assert company.memos.count() == 2
        assert company.followers.count() == 2
