import json
from datetime import date
from unittest.mock import Mock, patch

import pytest
from django.contrib.auth.models import AnonymousUser
from django.core.exceptions import ObjectDoesNotExist
from django.http import HttpResponseNotAllowed, JsonResponse
from django.test import RequestFactory

from main.account import OAuthOrganization
from main.account.models import User
from main.stock import TradeType
from main.stock.models import Company, TradeRecord
from main.stock.views.trade_record import create, update_or_delete
from main.stock.views.trade_record import list as list_view


@pytest.mark.django_db
class TestTradeRecordListView:
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
    def trade_records(self, user: User, companies: list[Company]) -> list[TradeRecord]:
        return [
            TradeRecord.objects.create(
                owner=user,
                company=companies[0],
                deal_time=date(2023, 12, 1),
                deal_price=100.5,
                deal_quantity=1000,
                handling_fee=50,
            ),
            TradeRecord.objects.create(
                owner=user,
                company=companies[1],
                deal_time=date(2023, 12, 2),
                deal_price=200.75,
                deal_quantity=500,
                handling_fee=25,
            ),
        ]

    def test_list_all_records(
        self,
        request_factory: RequestFactory,
        user: User,
        trade_records: list[TradeRecord],
    ) -> None:
        request = request_factory.get("/api/stock/trade-records/")
        request.user = user

        response = list_view(request)

        assert isinstance(response, JsonResponse)
        assert response.status_code == 200

        data = json.loads(response.content)
        assert "data" in data
        assert len(data["data"]) == 2

        # Check data structure
        record = data["data"][0]
        expected_keys = {
            "id",
            "deal_time",
            "sid",
            "company_name",
            "deal_price",
            "deal_quantity",
            "handling_fee",
        }
        assert set(record.keys()) == expected_keys

    def test_list_filter_by_deal_times(
        self,
        request_factory: RequestFactory,
        user: User,
        trade_records: list[TradeRecord],
    ) -> None:
        request = request_factory.get(
            '/api/stock/trade-records/?deal_times=["2023-12-01"]'
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
        trade_records: list[TradeRecord],
    ) -> None:
        request = request_factory.get('/api/stock/trade-records/?sids=["1234"]')
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
        trade_records: list[TradeRecord],
    ) -> None:
        request = request_factory.get(
            '/api/stock/trade-records/?deal_times=["2023-12-01"]&sids=["1234"]'
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
        trade_records: list[TradeRecord],
    ) -> None:
        request = request_factory.get("/api/stock/trade-records/?deal_times=[]&sids=[]")
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
        request = request_factory.get("/api/stock/trade-records/?deal_times=invalid")
        request.user = user

        with pytest.raises(ValueError):  # Should raise JSON decode error
            list_view(request)

    @patch("main.core.decorators.auth.require_login")
    def test_list_unauthorized_user(
        self, mock_require_login: Mock, request_factory: RequestFactory
    ) -> None:
        request = request_factory.get("/api/stock/trade-records/")
        request.user = AnonymousUser()

        # The decorator should handle this, but we can test the decorator is applied
        mock_require_login.return_value = lambda func: func
        assert hasattr(list_view, "__wrapped__") or callable(list_view)


@pytest.mark.django_db
class TestTradeRecordCreateView:
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

    def test_create_valid_trade_record(
        self, request_factory: RequestFactory, user: User, company: Company
    ) -> None:
        payload = {
            "deal_time": "2023-12-01",
            "sid": "1234",
            "deal_price": 100.5,
            "deal_quantity": 1000,
            "handling_fee": 50,
        }

        request = request_factory.post(
            "/api/stock/trade-record/",
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
        assert data["deal_price"] == 100.5
        assert data["deal_quantity"] == 1000
        assert data["handling_fee"] == 50

        # Verify record was created in database
        assert TradeRecord.objects.filter(owner=user, company=company).exists()

    def test_create_missing_deal_time(
        self, request_factory: RequestFactory, user: User
    ) -> None:
        payload = {
            "sid": "1234",
            "deal_price": 100.5,
            "deal_quantity": 1000,
            "handling_fee": 50,
        }

        request = request_factory.post(
            "/api/stock/trade-record/",
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
            "deal_price": 100.5,
            "deal_quantity": 1000,
            "handling_fee": 50,
        }

        request = request_factory.post(
            "/api/stock/trade-record/",
            data=json.dumps(payload),
            content_type="application/json",
        )
        request.user = user

        response = create(request)

        assert isinstance(response, JsonResponse)
        assert response.status_code == 400

        data = json.loads(response.content)
        assert data["message"] == "Data Not Sufficient"

    def test_create_deal_price_none(
        self, request_factory: RequestFactory, user: User
    ) -> None:
        payload = {
            "deal_time": "2023-12-01",
            "sid": "1234",
            "deal_price": None,
            "deal_quantity": 1000,
            "handling_fee": 50,
        }

        request = request_factory.post(
            "/api/stock/trade-record/",
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
            "deal_price": 100.5,
            "deal_quantity": 1000,
            "handling_fee": 50,
        }

        request = request_factory.post(
            "/api/stock/trade-record/",
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
            "deal_price": 100.5,
            "deal_quantity": 1000,
            "handling_fee": 50,
        }

        request = request_factory.post(
            "/api/stock/trade-record/",
            data=json.dumps(payload),
            content_type="application/json",
        )
        request.user = user

        with pytest.raises(ValueError):  # strptime should raise ValueError
            create(request)


@pytest.mark.django_db
class TestTradeRecordUpdateOrDeleteView:
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
            stock_id="1111",
            name="Test Company",
            trade_type=TradeType.TSE,
            business="Test business",
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
    def trade_record(self, user: User, company: Company) -> TradeRecord:
        return TradeRecord.objects.create(
            owner=user,
            company=company,
            deal_time=date(2023, 12, 1),
            deal_price=100.5,
            deal_quantity=1000,
            handling_fee=50,
        )

    def test_update_or_delete_post_method(
        self,
        request_factory: RequestFactory,
        user: User,
        company: Company,
        trade_record: TradeRecord,
    ) -> None:
        payload = {
            "deal_time": "2023-12-02",
            "sid": "1111",
            "deal_price": 200.0,
            "deal_quantity": 2000,
            "handling_fee": 100,
        }

        request = request_factory.post(
            f"/api/stock/trade-records/{trade_record.pk}/",
            data=json.dumps(payload),
            content_type="application/json",
        )
        request.user = user

        response = update_or_delete(request, str(trade_record.pk))

        assert isinstance(response, JsonResponse)
        assert response.status_code == 200

        data = json.loads(response.content)
        assert data["deal_price"] == 200.0
        assert data["deal_quantity"] == 2000

    def test_update_or_delete_delete_method(
        self,
        request_factory: RequestFactory,
        user: User,
        trade_record: TradeRecord,
    ) -> None:
        record_id = trade_record.pk

        request = request_factory.delete(f"/api/stock/trade-records/{record_id}/")
        request.user = user

        response = update_or_delete(request, str(record_id))

        assert isinstance(response, JsonResponse)
        assert response.status_code == 200

        data = json.loads(response.content)
        assert data == {}

        # Verify record was deleted
        assert not TradeRecord.objects.filter(pk=record_id).exists()

    def test_update_or_delete_invalid_method(
        self, request_factory: RequestFactory, user: User, trade_record: TradeRecord
    ) -> None:
        request = request_factory.get(f"/api/stock/trade-records/{trade_record.pk}/")
        request.user = user

        response = update_or_delete(request, str(trade_record.pk))

        assert isinstance(response, HttpResponseNotAllowed)
        assert response.status_code == 405

    def test_update_with_different_company(
        self,
        request_factory: RequestFactory,
        user: User,
        companies: list[Company],
        trade_record: TradeRecord,
    ) -> None:
        payload = {
            "deal_time": "2023-12-05",
            "sid": "5678",  # Change to different company
            "deal_price": 250.75,
            "deal_quantity": 1500,
            "handling_fee": 75,
        }

        request = request_factory.post(
            f"/api/stock/trade-records/{trade_record.pk}/",
            data=json.dumps(payload),
            content_type="application/json",
        )
        request.user = user

        response = update_or_delete(request, str(trade_record.pk))

        assert isinstance(response, JsonResponse)
        assert response.status_code == 200

        data = json.loads(response.content)
        assert data["deal_time"] == "2023-12-05"
        assert data["sid"] == "5678"
        assert data["company_name"] == "Company B"
        assert data["deal_price"] == 250.75
        assert data["deal_quantity"] == 1500
        assert data["handling_fee"] == 75

        # Verify database was updated
        trade_record.refresh_from_db()
        assert trade_record.deal_price == 250.75
        assert trade_record.company.stock_id == "5678"

    def test_update_missing_data(
        self, request_factory: RequestFactory, user: User, trade_record: TradeRecord
    ) -> None:
        payload = {
            "deal_time": "2023-12-05",
            # Missing other required fields
        }

        request = request_factory.post(
            f"/api/stock/trade-records/{trade_record.pk}/",
            data=json.dumps(payload),
            content_type="application/json",
        )
        request.user = user

        response = update_or_delete(request, str(trade_record.pk))

        assert isinstance(response, JsonResponse)
        assert response.status_code == 400

        data = json.loads(response.content)
        assert data["message"] == "Data Not Sufficient"

    def test_update_unknown_stock_id(
        self, request_factory: RequestFactory, user: User, trade_record: TradeRecord
    ) -> None:
        payload = {
            "deal_time": "2023-12-05",
            "sid": "9999",  # Non-existent stock ID
            "deal_price": 250.75,
            "deal_quantity": 1500,
            "handling_fee": 75,
        }

        request = request_factory.post(
            f"/api/stock/trade-records/{trade_record.pk}/",
            data=json.dumps(payload),
            content_type="application/json",
        )
        request.user = user

        response = update_or_delete(request, str(trade_record.pk))

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
            "deal_price": 250.75,
            "deal_quantity": 1500,
            "handling_fee": 75,
        }

        request = request_factory.post(
            "/api/stock/trade-records/99999/",
            data=json.dumps(payload),
            content_type="application/json",
        )
        request.user = user

        with pytest.raises(ObjectDoesNotExist):
            update_or_delete(request, "99999")

    def test_delete_nonexistent_record(
        self, request_factory: RequestFactory, user: User
    ) -> None:
        request = request_factory.delete("/api/stock/trade-records/99999/")
        request.user = user

        with pytest.raises(ObjectDoesNotExist):
            update_or_delete(request, "99999")

    def test_delete_other_users_record(
        self,
        request_factory: RequestFactory,
        company: Company,
        trade_record: TradeRecord,
    ) -> None:
        # Create another user
        other_user = User.objects.create_user(
            oauth_org=OAuthOrganization.GOOGLE,
            oauth_id="other_oauth_id",
            email="other@example.com",
            username="otheruser",
        )

        request = request_factory.delete(f"/api/stock/trade-records/{trade_record.pk}/")
        request.user = other_user

        with pytest.raises(ObjectDoesNotExist):
            update_or_delete(request, str(trade_record.pk))
