from datetime import datetime
from typing import Any

import pytest
from django.core.exceptions import ValidationError
from django.db import DataError, IntegrityError
from django.db.models.deletion import ProtectedError

from main.account.models import User
from main.market.models import Company
from main.trade_plan.models import TradePlan


@pytest.mark.django_db
class TestTradePlanModel:
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
    def trade_plan_data(self, user: User, company: Company) -> dict[str, Any]:
        return {
            "owner": user,
            "company": company,
            "plan_type": "buy",
            "target_price": 500.0,
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

    def test_trade_plan_meta_options(self) -> None:
        assert TradePlan._meta.app_label == "trade_plan"
        assert TradePlan._meta.db_table == "trade_plan"

    def test_trade_plan_allows_multiple_plans_per_user_company(
        self, trade_plan_data: dict[str, Any]
    ) -> None:
        TradePlan.objects.create(**trade_plan_data)
        TradePlan.objects.create(**trade_plan_data)

        assert TradePlan.objects.count() == 2

    def test_trade_plan_relationships(
        self, user: User, company: Company, trade_plan_data: dict[str, Any]
    ) -> None:
        plan = TradePlan.objects.create(**trade_plan_data)

        assert plan in user.trade_plans.all()

    def test_trade_plan_cascade_on_user_delete(
        self, user: User, trade_plan_data: dict[str, Any]
    ) -> None:
        plan = TradePlan.objects.create(**trade_plan_data)
        plan_id = plan.id

        user.delete()

        assert not TradePlan.objects.filter(id=plan_id).exists()

    def test_trade_plan_protect_on_company_delete(
        self, company: Company, trade_plan_data: dict[str, Any]
    ) -> None:
        TradePlan.objects.create(**trade_plan_data)

        with pytest.raises(ProtectedError):
            company.delete()

    def test_trade_plan_plan_type_max_length_validation(
        self, trade_plan_data: dict[str, Any]
    ) -> None:
        trade_plan_data["plan_type"] = "x" * 33
        plan = TradePlan(**trade_plan_data)

        with pytest.raises(ValidationError):
            plan.full_clean()

    def test_trade_plan_negative_quantity_rejected(
        self, trade_plan_data: dict[str, Any]
    ) -> None:
        trade_plan_data["target_quantity"] = -1

        with pytest.raises((DataError, IntegrityError, ValueError)):
            TradePlan.objects.create(**trade_plan_data)
