import json
from json import JSONDecodeError

import pytest
from django.http import HttpRequest
from django.test import RequestFactory

from main.account.models import User
from main.market.models import Company, MaterialFact
from main.stock_memo.models import StockMemo
from main.stock_memo.views import list_company_info, update_or_create_stock_memo


@pytest.mark.django_db
class TestStockMemoViews:
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

    def test_update_or_create_stock_memo_create_new(
        self, request_obj: HttpRequest, company: Company
    ) -> None:
        request_obj._body = json.dumps({"note": "New test memo"}).encode()

        response = update_or_create_stock_memo(request_obj, company.pk)
        data = json.loads(response.content)

        assert response.status_code == 200
        assert data["sid"] == company.pk
        assert data["note"] == "New test memo"
        assert StockMemo.objects.get(owner=request_obj.user, company=company).note == (
            "New test memo"
        )

    def test_update_or_create_stock_memo_unknown_company(
        self, request_obj: HttpRequest
    ) -> None:
        request_obj._body = json.dumps({"note": "Test memo"}).encode()

        response = update_or_create_stock_memo(request_obj, "unknown_sid")

        assert response.status_code == 400
        assert json.loads(response.content)["message"] == "Unknown Stock ID"

    def test_update_or_create_stock_memo_invalid_json(
        self, request_obj: HttpRequest, company: Company
    ) -> None:
        request_obj._body = b"invalid json"

        with pytest.raises(JSONDecodeError):
            update_or_create_stock_memo(request_obj, company.pk)

    def test_list_company_info_includes_stock_memo_and_material_facts(
        self, user: User, company: Company
    ) -> None:
        StockMemo.objects.create(owner=user, company=company, note="TSMC memo")
        MaterialFact.objects.create(
            company=company,
            date_time="2024-01-01T10:00:00Z",
            title="Material fact",
            description="Description",
        )
        request = RequestFactory().get("/", {"sids": company.pk})
        request.user = user  # type: ignore

        response = list_company_info(request)
        data = json.loads(response.content)

        assert response.status_code == 200
        assert data[company.pk]["note"] == "TSMC memo"
        assert data[company.pk]["material_facts"][0]["title"] == "Material fact"

    def test_list_company_info_requires_sids(self, user: User) -> None:
        request = RequestFactory().get("/")
        request.user = user  # type: ignore

        response = list_company_info(request)

        assert response.status_code == 400
        assert json.loads(response.content)["message"] == "sids is required."

    def test_list_company_info_unknown_company_returns_empty_map(
        self, user: User
    ) -> None:
        request = RequestFactory().get("/", {"sids": "unknown"})
        request.user = user  # type: ignore

        response = list_company_info(request)

        assert response.status_code == 200
        assert json.loads(response.content) == {}
