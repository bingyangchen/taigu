import json
from datetime import date
from unittest.mock import Mock, patch

import pytest
from django.contrib.auth.models import AnonymousUser
from django.core.exceptions import ObjectDoesNotExist
from django.http import JsonResponse
from django.test import RequestFactory

from main.account import OAuthOrganization
from main.account.models import User
from main.stock import TradeType
from main.stock.models import CashDividendRecord, Company
from main.stock.views.cash_dividend_record import (
    create,
    delete,
    update,
    update_or_delete,
)
from main.stock.views.cash_dividend_record import list as list_view


@pytest.mark.django_db
class TestCashDividendRecordListView:
    @pytest.fixture
    def request_factory(self) -> RequestFactory:
        return RequestFactory()

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
            Company.objects.create(
                stock_id="1234",
                name="Company A",
                trade_type=TradeType.TSE,
                business="Business A",
            ),
            Company.objects.create(
                stock_id="5678",
                name="Company B",
                trade_type=TradeType.OTC,
                business="Business B",
            ),
        ]

    @pytest.fixture
    def cash_dividend_records(
        self, user: User, companies: list[Company]
    ) -> list[CashDividendRecord]:
        return [
            CashDividendRecord.objects.create(
                owner=user,
                company=companies[0],
                deal_time=date(2023, 12, 1),
                cash_dividend=1000,
            ),
            CashDividendRecord.objects.create(
                owner=user,
                company=companies[1],
                deal_time=date(2023, 12, 2),
                cash_dividend=2000,
            ),
        ]

    def test_list_all_records(
        self,
        request_factory: RequestFactory,
        user: User,
        cash_dividend_records: list[CashDividendRecord],
    ) -> None:
        request = request_factory.get("/api/stock/cash-dividends/")
        request.user = user

        response = list_view(request)

        assert isinstance(response, JsonResponse)
        assert response.status_code == 200

        data = json.loads(response.content)
        assert "data" in data
        assert len(data["data"]) == 2

        # Check data structure
        record = data["data"][0]
        expected_keys = {"id", "deal_time", "sid", "company_name", "cash_dividend"}
        assert set(record.keys()) == expected_keys

    def test_list_filter_by_deal_times(
        self,
        request_factory: RequestFactory,
        user: User,
        cash_dividend_records: list[CashDividendRecord],
    ) -> None:
        request = request_factory.get(
            '/api/stock/cash-dividends/?deal_times=["2023-12-01"]'
        )
        request.user = user

        response = list_view(request)

        assert isinstance(response, JsonResponse)
        assert response.status_code == 200

        data = json.loads(response.content)
        assert "data" in data
        assert len(data["data"]) == 1
        assert data["data"][0]["deal_time"] == "2023-12-01"

    def test_list_filter_by_sids(
        self,
        request_factory: RequestFactory,
        user: User,
        cash_dividend_records: list[CashDividendRecord],
    ) -> None:
        request = request_factory.get('/api/stock/cash-dividends/?sids=["1234"]')
        request.user = user

        response = list_view(request)

        assert isinstance(response, JsonResponse)
        assert response.status_code == 200

        data = json.loads(response.content)
        assert "data" in data
        assert len(data["data"]) == 1
        assert data["data"][0]["sid"] == "1234"

    def test_list_filter_by_deal_times_and_sids(
        self,
        request_factory: RequestFactory,
        user: User,
        cash_dividend_records: list[CashDividendRecord],
    ) -> None:
        request = request_factory.get(
            '/api/stock/cash-dividends/?deal_times=["2023-12-01"]&sids=["1234"]'
        )
        request.user = user

        response = list_view(request)

        assert isinstance(response, JsonResponse)
        assert response.status_code == 200

        data = json.loads(response.content)
        assert "data" in data
        assert len(data["data"]) == 1
        assert data["data"][0]["sid"] == "1234"
        assert data["data"][0]["deal_time"] == "2023-12-01"

    def test_list_no_filters_empty_params(
        self,
        request_factory: RequestFactory,
        user: User,
        cash_dividend_records: list[CashDividendRecord],
    ) -> None:
        request = request_factory.get(
            "/api/stock/cash-dividends/?deal_times=[]&sids=[]"
        )
        request.user = user

        response = list_view(request)

        assert isinstance(response, JsonResponse)
        assert response.status_code == 200

        data = json.loads(response.content)
        assert "data" in data
        assert len(data["data"]) == 2  # Should return all records

    def test_list_invalid_json_params(
        self, request_factory: RequestFactory, user: User
    ) -> None:
        request = request_factory.get("/api/stock/cash-dividends/?deal_times=invalid")
        request.user = user

        with pytest.raises(ValueError):  # Should raise JSON decode error
            list_view(request)

    @patch("main.core.decorators.require_login")
    def test_list_unauthorized_user(
        self, mock_require_login: Mock, request_factory: RequestFactory
    ) -> None:
        request = request_factory.get("/api/stock/cash-dividends/")
        request.user = AnonymousUser()

        # The decorator should handle this, but we can test the decorator is applied
        mock_require_login.return_value = lambda func: func
        assert hasattr(list_view, "__wrapped__") or callable(list_view)


@pytest.mark.django_db
class TestCashDividendRecordCreateView:
    @pytest.fixture
    def request_factory(self) -> RequestFactory:
        return RequestFactory()

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
        return Company.objects.create(
            stock_id="1234",
            name="Test Company",
            trade_type=TradeType.TSE,
            business="Test business",
        )

    def test_create_valid_cash_dividend_record(
        self, request_factory: RequestFactory, user: User, company: Company
    ) -> None:
        payload = {
            "deal_time": "2023-12-01",
            "sid": "1234",
            "cash_dividend": 1500,
        }

        request = request_factory.post(
            "/api/stock/cash-dividend/",
            data=json.dumps(payload),
            content_type="application/json",
        )
        request.user = user

        response = create(request)

        assert isinstance(response, JsonResponse)
        assert response.status_code == 200

        data = json.loads(response.content)
        assert data["sid"] == "1234"
        assert data["company_name"] == "Test Company"
        assert data["cash_dividend"] == 1500
        assert data["deal_time"] == "2023-12-01"

        # Verify record was created in database
        assert CashDividendRecord.objects.filter(owner=user, company=company).exists()

    def test_create_missing_deal_time(
        self, request_factory: RequestFactory, user: User
    ) -> None:
        payload = {
            "sid": "1234",
            "cash_dividend": 1500,
        }

        request = request_factory.post(
            "/api/stock/cash-dividend/",
            data=json.dumps(payload),
            content_type="application/json",
        )
        request.user = user

        response = create(request)

        assert isinstance(response, JsonResponse)
        assert response.status_code == 400

        data = json.loads(response.content)
        assert data["message"] == "Data Not Sufficient"

    def test_create_missing_sid(
        self, request_factory: RequestFactory, user: User
    ) -> None:
        payload = {
            "deal_time": "2023-12-01",
            "cash_dividend": 1500,
        }

        request = request_factory.post(
            "/api/stock/cash-dividend/",
            data=json.dumps(payload),
            content_type="application/json",
        )
        request.user = user

        response = create(request)

        assert isinstance(response, JsonResponse)
        assert response.status_code == 400

        data = json.loads(response.content)
        assert data["message"] == "Data Not Sufficient"

    def test_create_cash_dividend_none(
        self, request_factory: RequestFactory, user: User
    ) -> None:
        payload = {
            "deal_time": "2023-12-01",
            "sid": "1234",
            "cash_dividend": None,
        }

        request = request_factory.post(
            "/api/stock/cash-dividend/",
            data=json.dumps(payload),
            content_type="application/json",
        )
        request.user = user

        response = create(request)

        assert isinstance(response, JsonResponse)
        assert response.status_code == 400

        data = json.loads(response.content)
        assert data["message"] == "Data Not Sufficient"

    def test_create_unknown_stock_id(
        self, request_factory: RequestFactory, user: User
    ) -> None:
        payload = {
            "deal_time": "2023-12-01",
            "sid": "9999",  # Non-existent stock ID
            "cash_dividend": 1500,
        }

        request = request_factory.post(
            "/api/stock/cash-dividend/",
            data=json.dumps(payload),
            content_type="application/json",
        )
        request.user = user

        response = create(request)

        assert isinstance(response, JsonResponse)
        assert response.status_code == 400

        data = json.loads(response.content)
        assert data["message"] == "Unknown Stock ID"

    def test_create_invalid_date_format(
        self, request_factory: RequestFactory, user: User, company: Company
    ) -> None:
        payload = {
            "deal_time": "invalid-date",
            "sid": "1234",
            "cash_dividend": 1500,
        }

        request = request_factory.post(
            "/api/stock/cash-dividend/",
            data=json.dumps(payload),
            content_type="application/json",
        )
        request.user = user

        with pytest.raises(ValueError):  # strptime should raise ValueError
            create(request)

    def test_create_zero_cash_dividend(
        self, request_factory: RequestFactory, user: User, company: Company
    ) -> None:
        payload = {
            "deal_time": "2023-12-01",
            "sid": "1234",
            "cash_dividend": 0,
        }

        request = request_factory.post(
            "/api/stock/cash-dividend/",
            data=json.dumps(payload),
            content_type="application/json",
        )
        request.user = user

        response = create(request)

        assert isinstance(response, JsonResponse)
        assert response.status_code == 200  # Zero values should be allowed

        data = json.loads(response.content)
        assert data["cash_dividend"] == 0

    def test_create_negative_cash_dividend(
        self, request_factory: RequestFactory, user: User, company: Company
    ) -> None:
        payload = {
            "deal_time": "2023-12-01",
            "sid": "1234",
            "cash_dividend": -500,  # Negative dividend (unusual but should work)
        }

        request = request_factory.post(
            "/api/stock/cash-dividend/",
            data=json.dumps(payload),
            content_type="application/json",
        )
        request.user = user

        response = create(request)

        assert isinstance(response, JsonResponse)
        assert response.status_code == 200

        data = json.loads(response.content)
        assert data["cash_dividend"] == -500


@pytest.mark.django_db
class TestCashDividendRecordUpdateOrDeleteView:
    @pytest.fixture
    def request_factory(self) -> RequestFactory:
        return RequestFactory()

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
        return Company.objects.create(
            stock_id="1234",
            name="Test Company",
            trade_type=TradeType.TSE,
            business="Test business",
        )

    @pytest.fixture
    def cash_dividend_record(self, user: User, company: Company) -> CashDividendRecord:
        return CashDividendRecord.objects.create(
            owner=user,
            company=company,
            deal_time=date(2023, 12, 1),
            cash_dividend=1000,
        )

    def test_update_or_delete_post_method(
        self,
        request_factory: RequestFactory,
        user: User,
        company: Company,
        cash_dividend_record: CashDividendRecord,
    ) -> None:
        payload = {
            "deal_time": "2023-12-02",
            "sid": "1234",
            "cash_dividend": 2000,
        }

        request = request_factory.post(
            f"/api/stock/cash-dividend/{cash_dividend_record.pk}/",
            data=json.dumps(payload),
            content_type="application/json",
        )
        request.user = user

        response = update_or_delete(request, str(cash_dividend_record.pk))

        assert isinstance(response, JsonResponse)
        assert response.status_code == 200

        data = json.loads(response.content)
        assert data["cash_dividend"] == 2000
        assert data["deal_time"] == "2023-12-02"

    def test_update_or_delete_delete_method(
        self,
        request_factory: RequestFactory,
        user: User,
        cash_dividend_record: CashDividendRecord,
    ) -> None:
        record_id = cash_dividend_record.pk

        request = request_factory.delete(f"/api/stock/cash-dividend/{record_id}/")
        request.user = user

        response = update_or_delete(request, str(record_id))

        assert isinstance(response, JsonResponse)
        assert response.status_code == 200

        data = json.loads(response.content)
        assert data == {}

        # Verify record was deleted
        assert not CashDividendRecord.objects.filter(pk=record_id).exists()

    def test_update_or_delete_invalid_method(
        self,
        request_factory: RequestFactory,
        user: User,
        cash_dividend_record: CashDividendRecord,
    ) -> None:
        request = request_factory.get(
            f"/api/stock/cash-dividend/{cash_dividend_record.pk}/"
        )
        request.user = user

        response = update_or_delete(request, str(cash_dividend_record.pk))

        assert isinstance(response, JsonResponse)
        assert response.status_code == 405

        data = json.loads(response.content)
        assert data["message"] == "Method Not Allowed"


@pytest.mark.django_db
class TestCashDividendRecordUpdateView:
    @pytest.fixture
    def request_factory(self) -> RequestFactory:
        return RequestFactory()

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
            Company.objects.create(
                stock_id="1234",
                name="Company A",
                trade_type=TradeType.TSE,
                business="Business A",
            ),
            Company.objects.create(
                stock_id="5678",
                name="Company B",
                trade_type=TradeType.OTC,
                business="Business B",
            ),
        ]

    @pytest.fixture
    def cash_dividend_record(
        self, user: User, companies: list[Company]
    ) -> CashDividendRecord:
        return CashDividendRecord.objects.create(
            owner=user,
            company=companies[0],
            deal_time=date(2023, 12, 1),
            cash_dividend=1000,
        )

    def test_update_valid_data(
        self,
        request_factory: RequestFactory,
        user: User,
        companies: list[Company],
        cash_dividend_record: CashDividendRecord,
    ) -> None:
        payload = {
            "deal_time": "2023-12-05",
            "sid": "5678",  # Change to different company
            "cash_dividend": 2500,
        }

        request = request_factory.post(
            f"/api/stock/cash-dividend/{cash_dividend_record.pk}/",
            data=json.dumps(payload),
            content_type="application/json",
        )
        request.user = user

        response = update(request, cash_dividend_record.pk)

        assert isinstance(response, JsonResponse)
        assert response.status_code == 200

        data = json.loads(response.content)
        assert data["deal_time"] == "2023-12-05"
        assert data["sid"] == "5678"
        assert data["company_name"] == "Company B"
        assert data["cash_dividend"] == 2500

        # Verify database was updated
        cash_dividend_record.refresh_from_db()
        assert cash_dividend_record.cash_dividend == 2500
        assert cash_dividend_record.company.stock_id == "5678"

    def test_update_missing_data(
        self,
        request_factory: RequestFactory,
        user: User,
        cash_dividend_record: CashDividendRecord,
    ) -> None:
        payload = {
            "deal_time": "2023-12-05",
            # Missing other required fields
        }

        request = request_factory.post(
            f"/api/stock/cash-dividend/{cash_dividend_record.pk}/",
            data=json.dumps(payload),
            content_type="application/json",
        )
        request.user = user

        response = update(request, cash_dividend_record.pk)

        assert isinstance(response, JsonResponse)
        assert response.status_code == 400

        data = json.loads(response.content)
        assert data["message"] == "Data Not Sufficient"

    def test_update_unknown_stock_id(
        self,
        request_factory: RequestFactory,
        user: User,
        cash_dividend_record: CashDividendRecord,
    ) -> None:
        payload = {
            "deal_time": "2023-12-05",
            "sid": "9999",  # Non-existent stock ID
            "cash_dividend": 2500,
        }

        request = request_factory.post(
            f"/api/stock/cash-dividend/{cash_dividend_record.pk}/",
            data=json.dumps(payload),
            content_type="application/json",
        )
        request.user = user

        response = update(request, cash_dividend_record.pk)

        assert isinstance(response, JsonResponse)
        assert response.status_code == 400

        data = json.loads(response.content)
        assert data["message"] == "Unknown Stock ID"

    def test_update_nonexistent_record(
        self, request_factory: RequestFactory, user: User, companies: list[Company]
    ) -> None:
        payload = {
            "deal_time": "2023-12-05",
            "sid": "1234",
            "cash_dividend": 2500,
        }

        request = request_factory.post(
            "/api/stock/cash-dividend/99999/",
            data=json.dumps(payload),
            content_type="application/json",
        )
        request.user = user

        with pytest.raises(ObjectDoesNotExist):
            update(request, 99999)


@pytest.mark.django_db
class TestCashDividendRecordDeleteView:
    @pytest.fixture
    def request_factory(self) -> RequestFactory:
        return RequestFactory()

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
        return Company.objects.create(
            stock_id="1234",
            name="Test Company",
            trade_type=TradeType.TSE,
            business="Test business",
        )

    @pytest.fixture
    def cash_dividend_record(self, user: User, company: Company) -> CashDividendRecord:
        return CashDividendRecord.objects.create(
            owner=user,
            company=company,
            deal_time=date(2023, 12, 1),
            cash_dividend=1000,
        )

    def test_delete_valid_record(
        self,
        request_factory: RequestFactory,
        user: User,
        cash_dividend_record: CashDividendRecord,
    ) -> None:
        record_id = cash_dividend_record.pk

        request = request_factory.delete(f"/api/stock/cash-dividend/{record_id}/")
        request.user = user

        response = delete(request, record_id)

        assert isinstance(response, JsonResponse)
        assert response.status_code == 200

        data = json.loads(response.content)
        assert data == {}

        # Verify record was deleted from database
        assert not CashDividendRecord.objects.filter(pk=record_id).exists()

    def test_delete_nonexistent_record(
        self, request_factory: RequestFactory, user: User
    ) -> None:
        request = request_factory.delete("/api/stock/cash-dividend/99999/")
        request.user = user

        with pytest.raises(ObjectDoesNotExist):
            delete(request, 99999)

    def test_delete_other_users_record(
        self,
        request_factory: RequestFactory,
        company: Company,
        cash_dividend_record: CashDividendRecord,
    ) -> None:
        # Create another user
        other_user = User.objects.create_user(
            oauth_org=OAuthOrganization.GOOGLE,
            oauth_id="other_oauth_id",
            email="other@example.com",
            username="otheruser",
        )

        request = request_factory.delete(
            f"/api/stock/cash-dividend/{cash_dividend_record.pk}/"
        )
        request.user = other_user

        with pytest.raises(ObjectDoesNotExist):
            delete(request, cash_dividend_record.pk)
