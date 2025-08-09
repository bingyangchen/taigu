import json
from json.decoder import JSONDecodeError
from typing import Any
from unittest.mock import Mock, patch

import pytest
from django.core.exceptions import ObjectDoesNotExist
from django.http import HttpRequest

from main.account import OAuthOrganization
from main.account.models import User
from main.memo.models import Favorite, StockMemo, TradePlan
from main.memo.views import (
    create_favorite,
    create_or_delete_favorite,
    create_trade_plan,
    delete_favorite,
    delete_trade_plan,
    list_company_info,
    list_favorites,
    list_trade_plans,
    update_or_create_stock_memo,
    update_or_delete_trade_plan,
    update_trade_plan,
)
from main.stock.models import Company


@pytest.mark.django_db
class TestUpdateOrCreateStockMemoView:
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
    def request_obj(self, user: User) -> HttpRequest:
        request = HttpRequest()
        request.user = user
        request.method = "POST"
        return request

    def test_update_or_create_stock_memo_create_new(
        self, request_obj: HttpRequest, company: Company
    ) -> None:
        body_data = json.dumps({"note": "New test memo"}).encode()
        request_obj._body = body_data

        response = update_or_create_stock_memo(request_obj, company.pk)

        assert response.status_code == 200
        data = json.loads(response.content)
        assert data["sid"] == company.pk
        assert data["company_name"] == company.name
        assert data["business"] == company.business
        assert data["note"] == "New test memo"

        # Verify memo was created in database
        memo = StockMemo.objects.get(owner=request_obj.user, company=company)
        assert memo.note == "New test memo"

    def test_update_or_create_stock_memo_update_existing(
        self, request_obj: HttpRequest, company: Company
    ) -> None:
        # Create existing memo
        existing_memo = StockMemo.objects.create(
            owner=request_obj.user, company=company, note="Original memo"
        )

        body_data = json.dumps({"note": "Updated memo"}).encode()
        request_obj._body = body_data

        response = update_or_create_stock_memo(request_obj, company.pk)

        assert response.status_code == 200
        data = json.loads(response.content)
        assert data["note"] == "Updated memo"

        # Verify memo was updated in database
        existing_memo.refresh_from_db()
        assert existing_memo.note == "Updated memo"

    def test_update_or_create_stock_memo_empty_note(
        self, request_obj: HttpRequest, company: Company
    ) -> None:
        body_data = json.dumps({"note": ""}).encode()
        request_obj._body = body_data

        response = update_or_create_stock_memo(request_obj, company.pk)

        assert response.status_code == 200
        data = json.loads(response.content)
        assert data["note"] == ""

    def test_update_or_create_stock_memo_null_note(
        self, request_obj: HttpRequest, company: Company
    ) -> None:
        body_data = json.dumps({"note": None}).encode()
        request_obj._body = body_data

        response = update_or_create_stock_memo(request_obj, company.pk)

        assert response.status_code == 200
        data = json.loads(response.content)
        assert data["note"] == ""

    def test_update_or_create_stock_memo_unknown_company(
        self, request_obj: HttpRequest
    ) -> None:
        body_data = json.dumps({"note": "Test memo"}).encode()
        request_obj._body = body_data

        response = update_or_create_stock_memo(request_obj, "unknown_sid")

        assert response.status_code == 400
        data = json.loads(response.content)
        assert data["message"] == "Unknown Stock ID"

    def test_update_or_create_stock_memo_invalid_json(
        self, request_obj: HttpRequest, company: Company
    ) -> None:
        request_obj._body = b"invalid json"

        with pytest.raises(JSONDecodeError):
            update_or_create_stock_memo(request_obj, company.pk)

    def test_update_or_create_stock_memo_missing_note_key(
        self, request_obj: HttpRequest, company: Company
    ) -> None:
        body_data = json.dumps({"other_field": "value"}).encode()
        request_obj._body = body_data

        with pytest.raises(KeyError):
            update_or_create_stock_memo(request_obj, company.pk)


@pytest.mark.django_db
class TestListCompanyInfoView:
    @pytest.fixture
    def user(self) -> User:
        return User.objects.create_user(
            oauth_org=OAuthOrganization.GOOGLE,
            oauth_id="test_oauth_id",
            email="test@example.com",
            username="testuser",
        )

    @pytest.fixture
    def companies(self) -> list[Company]:
        return [
            Company.objects.create(stock_id="2330", name="Taiwan Semiconductor"),
            Company.objects.create(stock_id="2317", name="Hon Hai"),
            Company.objects.create(stock_id="1301", name="Formosa Plastics"),
        ]

    @pytest.fixture
    def request_obj(self, user: User) -> HttpRequest:
        request = HttpRequest()
        request.user = user
        request.method = "GET"
        return request

    def test_list_company_info_success(
        self, request_obj: HttpRequest, companies: list[Company]
    ) -> None:
        # Create memos for some companies
        StockMemo.objects.create(
            owner=request_obj.user, company=companies[0], note="TSMC memo"
        )
        StockMemo.objects.create(
            owner=request_obj.user, company=companies[2], note="Formosa memo"
        )

        request_obj.GET = {"sids": "2330,2317,1301"}

        response = list_company_info(request_obj)

        assert response.status_code == 200
        data = json.loads(response.content)

        assert len(data) == 3
        assert "2330" in data
        assert "2317" in data
        assert "1301" in data

        # Check company info with memo
        tsmc_data = data["2330"]
        assert tsmc_data["sid"] == "2330"
        assert tsmc_data["company_name"] == "Taiwan Semiconductor"
        assert tsmc_data["note"] == "TSMC memo"
        assert "material_facts" in tsmc_data

        # Check company info without memo
        hon_hai_data = data["2317"]
        assert hon_hai_data["note"] == ""

    def test_list_company_info_with_trailing_comma(
        self, request_obj: HttpRequest, companies: list[Company]
    ) -> None:
        request_obj.GET = {"sids": "2330,2317,"}

        response = list_company_info(request_obj)

        assert response.status_code == 200
        data = json.loads(response.content)
        assert len(data) == 2

    def test_list_company_info_single_company(
        self, request_obj: HttpRequest, companies: list[Company]
    ) -> None:
        request_obj.GET = {"sids": "2330"}

        response = list_company_info(request_obj)

        assert response.status_code == 200
        data = json.loads(response.content)
        assert len(data) == 1
        assert "2330" in data

    def test_list_company_info_missing_sids(self, request_obj: HttpRequest) -> None:
        request_obj.GET = {}

        response = list_company_info(request_obj)

        assert response.status_code == 400
        data = json.loads(response.content)
        assert data["message"] == "sids is required."

    def test_list_company_info_empty_sids(self, request_obj: HttpRequest) -> None:
        request_obj.GET = {"sids": ""}

        response = list_company_info(request_obj)

        assert response.status_code == 400
        data = json.loads(response.content)
        assert data["message"] == "sids is required."

    def test_list_company_info_empty_sids_with_commas(
        self, request_obj: HttpRequest
    ) -> None:
        request_obj.GET = {"sids": ",,,"}

        response = list_company_info(request_obj)

        assert response.status_code == 400
        data = json.loads(response.content)
        assert data["message"] == "sids is required."

    def test_list_company_info_nonexistent_company(
        self, request_obj: HttpRequest
    ) -> None:
        request_obj.GET = {"sids": "nonexistent"}

        response = list_company_info(request_obj)

        assert response.status_code == 200
        data = json.loads(response.content)
        assert len(data) == 0

    def test_list_company_info_mixed_existing_nonexistent(
        self, request_obj: HttpRequest, companies: list[Company]
    ) -> None:
        request_obj.GET = {"sids": "2330,nonexistent,2317"}

        response = list_company_info(request_obj)

        assert response.status_code == 200
        data = json.loads(response.content)
        assert len(data) == 2
        assert "2330" in data
        assert "2317" in data
        assert "nonexistent" not in data


@pytest.mark.django_db
class TestCreateTradePlanView:
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
    def request_obj(self, user: User) -> HttpRequest:
        request = HttpRequest()
        request.user = user
        request.method = "POST"
        return request

    @pytest.fixture
    def valid_trade_plan_data(self, company: Company) -> dict[str, Any]:
        return {
            "sid": company.pk,
            "plan_type": "BUY",
            "target_price": 550.0,
            "target_quantity": 1000,
        }

    def test_create_trade_plan_success(
        self, request_obj: HttpRequest, valid_trade_plan_data: dict[str, Any]
    ) -> None:
        body_data = json.dumps(valid_trade_plan_data).encode()
        request_obj._body = body_data

        response = create_trade_plan(request_obj)

        assert response.status_code == 200
        data = json.loads(response.content)
        assert "id" in data
        assert data["sid"] == valid_trade_plan_data["sid"]
        assert data["company_name"] == "Taiwan Semiconductor"
        assert data["plan_type"] == valid_trade_plan_data["plan_type"]
        assert data["target_price"] == valid_trade_plan_data["target_price"]
        assert data["target_quantity"] == valid_trade_plan_data["target_quantity"]

        # Verify plan was created in database
        plan = TradePlan.objects.get(id=data["id"])
        assert plan.owner == request_obj.user
        assert plan.plan_type == "BUY"

    def test_create_trade_plan_string_target_quantity(
        self, request_obj: HttpRequest, company: Company
    ) -> None:
        trade_plan_data = {
            "sid": company.pk,
            "plan_type": "SELL",
            "target_price": 600.0,
            "target_quantity": "1500",  # String value
        }
        body_data = json.dumps(trade_plan_data).encode()
        request_obj._body = body_data

        response = create_trade_plan(request_obj)

        assert response.status_code == 200
        data = json.loads(response.content)
        assert data["target_quantity"] == 1500

    def test_create_trade_plan_missing_sid(self, request_obj: HttpRequest) -> None:
        trade_plan_data = {
            "plan_type": "BUY",
            "target_price": 550.0,
            "target_quantity": 1000,
        }
        body_data = json.dumps(trade_plan_data).encode()
        request_obj._body = body_data

        response = create_trade_plan(request_obj)

        assert response.status_code == 400
        data = json.loads(response.content)
        assert data["message"] == "Data Not Sufficient"

    def test_create_trade_plan_missing_plan_type(
        self, request_obj: HttpRequest, company: Company
    ) -> None:
        trade_plan_data = {
            "sid": company.pk,
            "target_price": 550.0,
            "target_quantity": 1000,
        }
        body_data = json.dumps(trade_plan_data).encode()
        request_obj._body = body_data

        response = create_trade_plan(request_obj)

        assert response.status_code == 400
        data = json.loads(response.content)
        assert data["message"] == "Data Not Sufficient"

    def test_create_trade_plan_missing_target_price(
        self, request_obj: HttpRequest, company: Company
    ) -> None:
        trade_plan_data = {
            "sid": company.pk,
            "plan_type": "BUY",
            "target_quantity": 1000,
        }
        body_data = json.dumps(trade_plan_data).encode()
        request_obj._body = body_data

        response = create_trade_plan(request_obj)

        assert response.status_code == 400
        data = json.loads(response.content)
        assert data["message"] == "Data Not Sufficient"

    def test_create_trade_plan_missing_target_quantity(
        self, request_obj: HttpRequest, company: Company
    ) -> None:
        trade_plan_data = {
            "sid": company.pk,
            "plan_type": "BUY",
            "target_price": 550.0,
        }
        body_data = json.dumps(trade_plan_data).encode()
        request_obj._body = body_data

        response = create_trade_plan(request_obj)

        assert response.status_code == 400
        data = json.loads(response.content)
        assert data["message"] == "Data Not Sufficient"

    def test_create_trade_plan_target_price_zero(
        self, request_obj: HttpRequest, company: Company
    ) -> None:
        trade_plan_data = {
            "sid": company.pk,
            "plan_type": "BUY",
            "target_price": 0,  # Zero is a valid value
            "target_quantity": 1000,
        }
        body_data = json.dumps(trade_plan_data).encode()
        request_obj._body = body_data

        response = create_trade_plan(request_obj)

        assert response.status_code == 200
        data = json.loads(response.content)
        assert data["target_price"] == 0

    def test_create_trade_plan_target_quantity_zero(
        self, request_obj: HttpRequest, company: Company
    ) -> None:
        trade_plan_data = {
            "sid": company.pk,
            "plan_type": "BUY",
            "target_price": 550.0,
            "target_quantity": 0,  # Zero is a valid value
        }
        body_data = json.dumps(trade_plan_data).encode()
        request_obj._body = body_data

        response = create_trade_plan(request_obj)

        assert response.status_code == 200
        data = json.loads(response.content)
        assert data["target_quantity"] == 0

    def test_create_trade_plan_unknown_company(self, request_obj: HttpRequest) -> None:
        trade_plan_data = {
            "sid": "unknown_sid",
            "plan_type": "BUY",
            "target_price": 550.0,
            "target_quantity": 1000,
        }
        body_data = json.dumps(trade_plan_data).encode()
        request_obj._body = body_data

        response = create_trade_plan(request_obj)

        assert response.status_code == 400
        data = json.loads(response.content)
        assert data["message"] == "Unknown Stock ID"

    def test_create_trade_plan_invalid_json(self, request_obj: HttpRequest) -> None:
        request_obj._body = b"invalid json"

        with pytest.raises(JSONDecodeError):
            create_trade_plan(request_obj)


@pytest.mark.django_db
class TestListTradePlansView:
    @pytest.fixture
    def user(self) -> User:
        return User.objects.create_user(
            oauth_org=OAuthOrganization.GOOGLE,
            oauth_id="test_oauth_id",
            email="test@example.com",
            username="testuser",
        )

    @pytest.fixture
    def companies(self) -> list[Company]:
        return [
            Company.objects.create(stock_id="2330", name="Taiwan Semiconductor"),
            Company.objects.create(stock_id="2317", name="Hon Hai"),
        ]

    @pytest.fixture
    def trade_plans(self, user: User, companies: list[Company]) -> list[TradePlan]:
        return [
            TradePlan.objects.create(
                owner=user,
                company=companies[0],
                plan_type="BUY",
                target_price=550.0,
                target_quantity=1000,
            ),
            TradePlan.objects.create(
                owner=user,
                company=companies[1],
                plan_type="SELL",
                target_price=100.0,
                target_quantity=500,
            ),
        ]

    @pytest.fixture
    def request_obj(self, user: User) -> HttpRequest:
        request = HttpRequest()
        request.user = user
        request.method = "GET"
        return request

    def test_list_trade_plans_all(
        self, request_obj: HttpRequest, trade_plans: list[TradePlan]
    ) -> None:
        request_obj.GET = {}

        response = list_trade_plans(request_obj)

        assert response.status_code == 200
        data = json.loads(response.content)
        assert len(data["data"]) == 2

        plan_data = data["data"][0]
        assert "id" in plan_data
        assert "sid" in plan_data
        assert "company_name" in plan_data
        assert "plan_type" in plan_data
        assert "target_price" in plan_data
        assert "target_quantity" in plan_data

    def test_list_trade_plans_filtered_by_sids(
        self, request_obj: HttpRequest, trade_plans: list[TradePlan]
    ) -> None:
        request_obj.GET = {"sids": "2330"}

        response = list_trade_plans(request_obj)

        assert response.status_code == 200
        data = json.loads(response.content)
        assert len(data["data"]) == 1
        assert data["data"][0]["sid"] == "2330"

    def test_list_trade_plans_filtered_by_multiple_sids(
        self, request_obj: HttpRequest, trade_plans: list[TradePlan]
    ) -> None:
        request_obj.GET = {"sids": "2330,2317"}

        response = list_trade_plans(request_obj)

        assert response.status_code == 200
        data = json.loads(response.content)
        assert len(data["data"]) == 2

    def test_list_trade_plans_filtered_by_nonexistent_sid(
        self, request_obj: HttpRequest, trade_plans: list[TradePlan]
    ) -> None:
        request_obj.GET = {"sids": "nonexistent"}

        response = list_trade_plans(request_obj)

        assert response.status_code == 200
        data = json.loads(response.content)
        assert len(data["data"]) == 0

    def test_list_trade_plans_empty_sids(
        self, request_obj: HttpRequest, trade_plans: list[TradePlan]
    ) -> None:
        request_obj.GET = {"sids": ""}

        response = list_trade_plans(request_obj)

        assert response.status_code == 200
        data = json.loads(response.content)
        assert len(data["data"]) == 2  # Should return all plans

    def test_list_trade_plans_with_trailing_comma(
        self, request_obj: HttpRequest, trade_plans: list[TradePlan]
    ) -> None:
        request_obj.GET = {"sids": "2330,"}

        response = list_trade_plans(request_obj)

        assert response.status_code == 200
        data = json.loads(response.content)
        assert len(data["data"]) == 1

    def test_list_trade_plans_no_plans(self, request_obj: HttpRequest) -> None:
        request_obj.GET = {}

        response = list_trade_plans(request_obj)

        assert response.status_code == 200
        data = json.loads(response.content)
        assert len(data["data"]) == 0


@pytest.mark.django_db
class TestUpdateOrDeleteTradePlanView:
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
    def trade_plan(self, user: User, company: Company) -> TradePlan:
        return TradePlan.objects.create(
            owner=user,
            company=company,
            plan_type="BUY",
            target_price=550.0,
            target_quantity=1000,
        )

    @pytest.fixture
    def request_obj(self, user: User) -> HttpRequest:
        request = HttpRequest()
        request.user = user
        return request

    def test_update_or_delete_trade_plan_post_method(
        self, request_obj: HttpRequest, trade_plan: TradePlan, company: Company
    ) -> None:
        request_obj.method = "POST"
        update_data = {
            "sid": company.pk,
            "plan_type": "SELL",
            "target_price": 600.0,
            "target_quantity": 1500,
        }
        body_data = json.dumps(update_data).encode()
        request_obj._body = body_data

        response = update_or_delete_trade_plan(request_obj, str(trade_plan.id))

        assert response.status_code == 200
        data = json.loads(response.content)
        assert data["plan_type"] == "SELL"
        assert data["target_price"] == 600.0
        assert data["target_quantity"] == 1500

    def test_update_or_delete_trade_plan_delete_method(
        self, request_obj: HttpRequest, trade_plan: TradePlan
    ) -> None:
        request_obj.method = "DELETE"
        plan_id = trade_plan.id

        response = update_or_delete_trade_plan(request_obj, str(plan_id))

        assert response.status_code == 200
        data = json.loads(response.content)
        assert data == {}

        # Verify plan was deleted
        assert not TradePlan.objects.filter(id=plan_id).exists()

    def test_update_or_delete_trade_plan_unsupported_method(
        self, request_obj: HttpRequest, trade_plan: TradePlan
    ) -> None:
        request_obj.method = "GET"

        response = update_or_delete_trade_plan(request_obj, str(trade_plan.id))

        assert response.status_code == 405
        data = json.loads(response.content)
        assert data["message"] == "Method Not Allowed"


@pytest.mark.django_db
class TestUpdateTradePlanView:
    @pytest.fixture
    def user(self) -> User:
        return User.objects.create_user(
            oauth_org=OAuthOrganization.GOOGLE,
            oauth_id="test_oauth_id",
            email="test@example.com",
            username="testuser",
        )

    @pytest.fixture
    def companies(self) -> list[Company]:
        return [
            Company.objects.create(stock_id="2330", name="Taiwan Semiconductor"),
            Company.objects.create(stock_id="2317", name="Hon Hai"),
        ]

    @pytest.fixture
    def trade_plan(self, user: User, companies: list[Company]) -> TradePlan:
        return TradePlan.objects.create(
            owner=user,
            company=companies[0],
            plan_type="BUY",
            target_price=550.0,
            target_quantity=1000,
        )

    @pytest.fixture
    def request_obj(self, user: User) -> HttpRequest:
        request = HttpRequest()
        request.user = user
        request.method = "POST"
        return request

    def test_update_trade_plan_success(
        self, request_obj: HttpRequest, trade_plan: TradePlan, companies: list[Company]
    ) -> None:
        update_data = {
            "sid": companies[1].pk,  # Change company
            "plan_type": "SELL",
            "target_price": 600.0,
            "target_quantity": 1500,
        }
        body_data = json.dumps(update_data).encode()
        request_obj._body = body_data

        response = update_trade_plan(request_obj, trade_plan.id)

        assert response.status_code == 200
        data = json.loads(response.content)
        assert data["id"] == trade_plan.id
        assert data["sid"] == companies[1].pk
        assert data["company_name"] == companies[1].name
        assert data["plan_type"] == "SELL"
        assert data["target_price"] == 600.0
        assert data["target_quantity"] == 1500

        # Verify plan was updated in database
        trade_plan.refresh_from_db()
        assert trade_plan.company == companies[1]
        assert trade_plan.plan_type == "SELL"

    def test_update_trade_plan_missing_data(
        self, request_obj: HttpRequest, trade_plan: TradePlan
    ) -> None:
        update_data = {
            "plan_type": "SELL",
            "target_price": 600.0,
            # Missing sid and target_quantity
        }
        body_data = json.dumps(update_data).encode()
        request_obj._body = body_data

        response = update_trade_plan(request_obj, trade_plan.id)

        assert response.status_code == 400
        data = json.loads(response.content)
        assert data["message"] == "Data Not Sufficient"

    def test_update_trade_plan_unknown_company(
        self, request_obj: HttpRequest, trade_plan: TradePlan
    ) -> None:
        update_data = {
            "sid": "unknown_sid",
            "plan_type": "SELL",
            "target_price": 600.0,
            "target_quantity": 1500,
        }
        body_data = json.dumps(update_data).encode()
        request_obj._body = body_data

        response = update_trade_plan(request_obj, trade_plan.id)

        assert response.status_code == 400
        data = json.loads(response.content)
        assert data["message"] == "Unknown Stock ID"


@pytest.mark.django_db
class TestDeleteTradePlanView:
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
    def trade_plan(self, user: User, company: Company) -> TradePlan:
        return TradePlan.objects.create(
            owner=user,
            company=company,
            plan_type="BUY",
            target_price=550.0,
            target_quantity=1000,
        )

    @pytest.fixture
    def request_obj(self, user: User) -> HttpRequest:
        request = HttpRequest()
        request.user = user
        request.method = "DELETE"
        return request

    def test_delete_trade_plan_success(
        self, request_obj: HttpRequest, trade_plan: TradePlan
    ) -> None:
        plan_id = trade_plan.id

        response = delete_trade_plan(request_obj, plan_id)

        assert response.status_code == 200
        data = json.loads(response.content)
        assert data == {}

        # Verify plan was deleted
        assert not TradePlan.objects.filter(id=plan_id).exists()

    def test_delete_trade_plan_not_owner(self, trade_plan: TradePlan) -> None:
        # Create different user
        other_user = User.objects.create_user(
            oauth_org=OAuthOrganization.GOOGLE,
            oauth_id="other_oauth_id",
            email="other@example.com",
            username="otheruser",
        )

        request = HttpRequest()
        request.user = other_user
        request.method = "DELETE"

        # Should raise an exception because the plan doesn't belong to this user
        with pytest.raises(TradePlan.DoesNotExist):
            delete_trade_plan(request, trade_plan.id)


@pytest.mark.django_db
class TestCreateOrDeleteFavoriteView:
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
    def request_obj(self, user: User) -> HttpRequest:
        request = HttpRequest()
        request.user = user
        return request

    def test_create_or_delete_favorite_post_method(
        self, request_obj: HttpRequest, company: Company
    ) -> None:
        request_obj.method = "POST"

        response = create_or_delete_favorite(request_obj, company.pk)

        assert response.status_code == 200
        data = json.loads(response.content)
        assert data["sid"] == company.pk

        # Verify favorite was created
        assert Favorite.objects.filter(owner=request_obj.user, company=company).exists()

    def test_create_or_delete_favorite_delete_method(
        self, request_obj: HttpRequest, company: Company
    ) -> None:
        # Create favorite first
        Favorite.objects.create(owner=request_obj.user, company=company)

        request_obj.method = "DELETE"

        response = create_or_delete_favorite(request_obj, company.pk)

        assert response.status_code == 200
        data = json.loads(response.content)
        assert data["sid"] == company.pk

        # Verify favorite was deleted
        assert not Favorite.objects.filter(
            owner=request_obj.user, company=company
        ).exists()

    def test_create_or_delete_favorite_unsupported_method(
        self, request_obj: HttpRequest, company: Company
    ) -> None:
        request_obj.method = "GET"

        response = create_or_delete_favorite(request_obj, company.pk)

        assert response.status_code == 405
        data = json.loads(response.content)
        assert data["message"] == "Method Not Allowed"


@pytest.mark.django_db
class TestCreateFavoriteView:
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
    def request_obj(self, user: User) -> HttpRequest:
        request = HttpRequest()
        request.user = user
        request.method = "POST"
        return request

    def test_create_favorite_success(
        self, request_obj: HttpRequest, company: Company
    ) -> None:
        response = create_favorite(request_obj, company.pk)

        assert response.status_code == 200
        data = json.loads(response.content)
        assert data["sid"] == company.pk

        # Verify favorite was created
        favorite = Favorite.objects.get(owner=request_obj.user, company=company)
        assert favorite is not None

    def test_create_favorite_get_or_create_existing(
        self, request_obj: HttpRequest, company: Company
    ) -> None:
        # Create favorite first
        existing_favorite = Favorite.objects.create(
            owner=request_obj.user, company=company
        )

        response = create_favorite(request_obj, company.pk)

        assert response.status_code == 200
        data = json.loads(response.content)
        assert data["sid"] == company.pk

        # Should still have only one favorite
        assert (
            Favorite.objects.filter(owner=request_obj.user, company=company).count()
            == 1
        )

        # Should be the same favorite
        favorite = Favorite.objects.get(owner=request_obj.user, company=company)
        assert favorite.id == existing_favorite.id

    def test_create_favorite_unknown_company(self, request_obj: HttpRequest) -> None:
        with pytest.raises(ObjectDoesNotExist):
            create_favorite(request_obj, "unknown_sid")


@pytest.mark.django_db
class TestDeleteFavoriteView:
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
    def favorite(self, user: User, company: Company) -> Favorite:
        return Favorite.objects.create(owner=user, company=company)

    @pytest.fixture
    def request_obj(self, user: User) -> HttpRequest:
        request = HttpRequest()
        request.user = user
        request.method = "DELETE"
        return request

    def test_delete_favorite_success(
        self, request_obj: HttpRequest, favorite: Favorite, company: Company
    ) -> None:
        response = delete_favorite(request_obj, company.pk)

        assert response.status_code == 200
        data = json.loads(response.content)
        assert data["sid"] == company.pk

        # Verify favorite was deleted
        assert not Favorite.objects.filter(id=favorite.id).exists()

    def test_delete_favorite_not_found(
        self, request_obj: HttpRequest, company: Company
    ) -> None:
        # No favorite exists
        with pytest.raises(ObjectDoesNotExist):
            delete_favorite(request_obj, company.pk)

    def test_delete_favorite_unknown_company(self, request_obj: HttpRequest) -> None:
        with pytest.raises(ObjectDoesNotExist):
            delete_favorite(request_obj, "unknown_sid")


@pytest.mark.django_db
class TestListFavoritesView:
    @pytest.fixture
    def user(self) -> User:
        return User.objects.create_user(
            oauth_org=OAuthOrganization.GOOGLE,
            oauth_id="test_oauth_id",
            email="test@example.com",
            username="testuser",
        )

    @pytest.fixture
    def companies(self) -> list[Company]:
        return [
            Company.objects.create(stock_id="2330", name="Taiwan Semiconductor"),
            Company.objects.create(stock_id="2317", name="Hon Hai"),
            Company.objects.create(stock_id="1301", name="Formosa Plastics"),
        ]

    @pytest.fixture
    def favorites(self, user: User, companies: list[Company]) -> list[Favorite]:
        return [
            Favorite.objects.create(owner=user, company=companies[0]),
            Favorite.objects.create(owner=user, company=companies[2]),
        ]

    @pytest.fixture
    def request_obj(self, user: User) -> HttpRequest:
        request = HttpRequest()
        request.user = user
        request.method = "GET"
        return request

    def test_list_favorites_success(
        self, request_obj: HttpRequest, favorites: list[Favorite]
    ) -> None:
        response = list_favorites(request_obj)

        assert response.status_code == 200
        data = json.loads(response.content)
        assert len(data["data"]) == 2
        assert "2330" in data["data"]
        assert "1301" in data["data"]
        assert "2317" not in data["data"]

    def test_list_favorites_no_favorites(self, request_obj: HttpRequest) -> None:
        response = list_favorites(request_obj)

        assert response.status_code == 200
        data = json.loads(response.content)
        assert len(data["data"]) == 0

    def test_list_favorites_other_user_favorites_not_included(
        self, request_obj: HttpRequest, companies: list[Company]
    ) -> None:
        # Create another user with favorites
        other_user = User.objects.create_user(
            oauth_org=OAuthOrganization.GOOGLE,
            oauth_id="other_oauth_id",
            email="other@example.com",
            username="otheruser",
        )
        Favorite.objects.create(owner=other_user, company=companies[1])

        # Create favorite for main user
        Favorite.objects.create(owner=request_obj.user, company=companies[0])

        response = list_favorites(request_obj)

        assert response.status_code == 200
        data = json.loads(response.content)
        assert len(data["data"]) == 1
        assert data["data"][0] == companies[0].pk


@pytest.mark.django_db
class TestMemoViewsIntegration:
    """Integration tests that test view interactions and edge cases."""

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

    def test_memo_views_with_material_facts_mock(
        self, user: User, company: Company
    ) -> None:
        """Test that list_company_info handles material facts correctly."""
        # Create a mock material fact object
        mock_material_fact = Mock()
        mock_material_fact.date_time = "2023-01-01T10:00:00"
        mock_material_fact.title = "Test Material Fact"
        mock_material_fact.description = "Test Description"

        # Mock the Company queryset and material_facts relation
        with patch("main.memo.views.Company.objects") as mock_company_objects:
            # Create a more realistic mock company that can be serialized
            class MockCompany:
                def __init__(self, pk: int, stock_id: str, name: str) -> None:
                    self.pk = pk
                    self.stock_id = stock_id
                    self.name = name
                    self.business = "Technology"  # Provide a valid business value

                    # Mock material_facts manager
                    self.material_facts = Mock()
                    self.material_facts.all.return_value = [mock_material_fact]

            mock_company = MockCompany(company.pk, company.stock_id, company.name)
            mock_queryset = Mock()
            mock_queryset.filter.return_value = [mock_company]
            mock_company_objects.prefetch_related.return_value = mock_queryset

            request = HttpRequest()
            request.user = user
            request.method = "GET"
            request.GET = {"sids": company.pk}

            response = list_company_info(request)

            assert response.status_code == 200
            data = json.loads(response.content)
            company_data = data[str(company.pk)]
            assert len(company_data["material_facts"]) == 1
            assert company_data["material_facts"][0]["title"] == "Test Material Fact"

    def test_complete_memo_workflow(self, user: User, company: Company) -> None:
        """Test a complete workflow using multiple memo views."""
        request = HttpRequest()
        request.user = user

        # 1. Create a stock memo
        request.method = "POST"
        memo_data = json.dumps({"note": "Great investment"}).encode()
        request._body = memo_data
        memo_response = update_or_create_stock_memo(request, company.pk)
        assert memo_response.status_code == 200

        # 2. Create a trade plan
        plan_data = json.dumps(
            {
                "sid": company.pk,
                "plan_type": "BUY",
                "target_price": 550.0,
                "target_quantity": 1000,
            }
        ).encode()
        request._body = plan_data
        plan_response = create_trade_plan(request)
        assert plan_response.status_code == 200
        plan_id = json.loads(plan_response.content)["id"]

        # 3. Create a favorite
        favorite_response = create_favorite(request, company.pk)
        assert favorite_response.status_code == 200

        # 4. List company info (should include memo)
        request.method = "GET"
        request.GET = {"sids": company.pk}
        info_response = list_company_info(request)
        assert info_response.status_code == 200
        info_data = json.loads(info_response.content)
        assert info_data[company.pk]["note"] == "Great investment"

        # 5. List trade plans
        plans_response = list_trade_plans(request)
        assert plans_response.status_code == 200
        plans_data = json.loads(plans_response.content)
        assert len(plans_data["data"]) == 1

        # 6. List favorites
        favorites_response = list_favorites(request)
        assert favorites_response.status_code == 200
        favorites_data = json.loads(favorites_response.content)
        assert company.pk in favorites_data["data"]

        # 7. Update the memo
        request.method = "POST"
        updated_memo_data = json.dumps({"note": "Even better investment"}).encode()
        request._body = updated_memo_data
        updated_memo_response = update_or_create_stock_memo(request, company.pk)
        assert updated_memo_response.status_code == 200

        # 8. Delete the trade plan
        request.method = "DELETE"
        delete_plan_response = delete_trade_plan(request, plan_id)
        assert delete_plan_response.status_code == 200

        # 9. Delete the favorite
        delete_favorite_response = delete_favorite(request, company.pk)
        assert delete_favorite_response.status_code == 200

        # Verify final state
        assert StockMemo.objects.filter(owner=user, company=company).exists()
        assert not TradePlan.objects.filter(id=plan_id).exists()
        assert not Favorite.objects.filter(owner=user, company=company).exists()
