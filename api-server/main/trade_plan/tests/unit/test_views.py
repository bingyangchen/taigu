import json
from json import JSONDecodeError
from typing import Any

import pytest
from django.http import HttpRequest
from django.test import RequestFactory

from main.account.models import User
from main.market.models import Company
from main.trade_plan.models import TradePlan
from main.trade_plan.views import (
    _delete_trade_plan,
    _update_trade_plan,
    create_trade_plan,
    list_trade_plans,
    update_or_delete_trade_plan,
)


@pytest.mark.django_db
class TestTradePlanViews:
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

    @pytest.fixture
    def valid_trade_plan_data(self, company: Company) -> dict[str, Any]:
        return {
            "sid": company.pk,
            "plan_type": "buy",
            "target_price": 500.0,
            "target_quantity": 1000,
        }

    def test_create_trade_plan_success(
        self, request_obj: HttpRequest, valid_trade_plan_data: dict[str, Any]
    ) -> None:
        request_obj._body = json.dumps(valid_trade_plan_data).encode()

        response = create_trade_plan(request_obj)
        data = json.loads(response.content)

        assert response.status_code == 200
        assert data["sid"] == valid_trade_plan_data["sid"]
        assert data["plan_type"] == valid_trade_plan_data["plan_type"]
        assert TradePlan.objects.get(id=data["id"]).owner == request_obj.user

    def test_create_trade_plan_rejects_missing_data(
        self, request_obj: HttpRequest
    ) -> None:
        request_obj._body = json.dumps({"sid": "2330"}).encode()

        response = create_trade_plan(request_obj)

        assert response.status_code == 400
        assert json.loads(response.content)["message"] == "Data Not Sufficient"

    def test_create_trade_plan_rejects_negative_quantity(
        self, request_obj: HttpRequest, valid_trade_plan_data: dict[str, Any]
    ) -> None:
        valid_trade_plan_data["target_quantity"] = -1
        request_obj._body = json.dumps(valid_trade_plan_data).encode()

        response = create_trade_plan(request_obj)

        assert response.status_code == 400
        assert json.loads(response.content)["message"] == (
            "Target quantity must be positive"
        )

    def test_create_trade_plan_invalid_json(self, request_obj: HttpRequest) -> None:
        request_obj._body = b"invalid json"

        with pytest.raises(JSONDecodeError):
            create_trade_plan(request_obj)

    def test_list_trade_plans_success(self, user: User, company: Company) -> None:
        plan = TradePlan.objects.create(
            owner=user,
            company=company,
            plan_type="buy",
            target_price=500.0,
            target_quantity=1000,
        )
        request = RequestFactory().get("/")
        request.user = user  # type: ignore

        response = list_trade_plans(request)
        data = json.loads(response.content)

        assert response.status_code == 200
        assert data["data"][0]["id"] == plan.id

    def test_update_trade_plan_success(
        self, user: User, company: Company, request_obj: HttpRequest
    ) -> None:
        plan = TradePlan.objects.create(
            owner=user,
            company=company,
            plan_type="buy",
            target_price=500.0,
            target_quantity=1000,
        )
        request_obj._body = json.dumps(
            {
                "sid": company.pk,
                "plan_type": "sell",
                "target_price": 600.0,
                "target_quantity": 2000,
            }
        ).encode()

        response = _update_trade_plan(request_obj, plan.id)
        data = json.loads(response.content)

        assert response.status_code == 200
        assert data["plan_type"] == "sell"
        assert data["target_price"] == 600.0

    def test_delete_trade_plan_success(
        self, user: User, company: Company, request_obj: HttpRequest
    ) -> None:
        plan = TradePlan.objects.create(
            owner=user,
            company=company,
            plan_type="buy",
            target_price=500.0,
            target_quantity=1000,
        )

        response = _delete_trade_plan(request_obj, plan.id)

        assert response.status_code == 200
        assert not TradePlan.objects.filter(id=plan.id).exists()

    def test_update_or_delete_trade_plan_delete_method(
        self, user: User, company: Company
    ) -> None:
        plan = TradePlan.objects.create(
            owner=user,
            company=company,
            plan_type="buy",
            target_price=500.0,
            target_quantity=1000,
        )
        request = RequestFactory().delete("/")
        request.user = user  # type: ignore

        response = update_or_delete_trade_plan(request, plan.id)

        assert response.status_code == 200
        assert not TradePlan.objects.filter(id=plan.id).exists()
