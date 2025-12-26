import json
from datetime import date
from typing import Any
from unittest.mock import Mock, patch

import pytest
from django.core.exceptions import ObjectDoesNotExist
from django.http import JsonResponse
from django.test import RequestFactory

from main.stock import Frequency, TradeType
from main.stock.cache import TimeSeriesStockInfo
from main.stock.models import Company, History, StockInfo
from main.stock.views.stock_info import (
    current_stock_info,
    historical_prices,
    market_index,
    search,
)


@pytest.mark.django_db
class TestMarketIndexView:
    @pytest.fixture
    def request_factory(self) -> RequestFactory:
        return RequestFactory()

    @pytest.fixture
    def mock_cache_data(self) -> dict[str, Any]:
        return {
            "data": {
                30: {"date": date(2023, 12, 1), "price": 15000.0, "fluct_price": 50.0},
                60: {"date": date(2023, 12, 1), "price": 15050.0, "fluct_price": 100.0},
            }
        }

    @patch("main.stock.views.stock_info.TimeSeriesStockInfoCacheManager.get")
    def test_market_index_with_cache_hit(
        self,
        mock_get: Mock,
        request_factory: RequestFactory,
        mock_cache_data: dict[str, Any],
    ) -> None:
        # Setup cache manager mock
        # Create a real TimeSeriesStockInfo object for the cache result
        cache_result = TimeSeriesStockInfo.model_validate(mock_cache_data)

        # Mock get to return the cache result for both TSE and OTC
        def get_side_effect(market_id: str) -> TimeSeriesStockInfo | None:
            if market_id in (TradeType.TSE, TradeType.OTC):
                return cache_result
            return None

        mock_get.side_effect = get_side_effect

        request = request_factory.get("/api/stock/market-index/")

        response = market_index(request)

        assert isinstance(response, JsonResponse)
        assert response.status_code == 200

        data = json.loads(response.content)
        assert TradeType.TSE in data
        assert TradeType.OTC in data

        # JSON serialization converts integer keys to strings and dates to strings
        expected_data = {
            "30": {"date": "2023-12-01", "price": 15000.0, "fluct_price": 50.0},
            "60": {"date": "2023-12-01", "price": 15050.0, "fluct_price": 100.0},
        }
        assert data[TradeType.TSE] == expected_data
        assert data[TradeType.OTC] == expected_data

    @patch("main.stock.views.stock_info.TimeSeriesStockInfoCacheManager.get")
    @patch("main.stock.views.stock_info.TimeSeriesStockInfoCacheManager.set")
    @patch("main.stock.views.stock_info.MarketIndexPerMinute.objects.filter")
    def test_market_index_with_cache_miss(
        self,
        mock_filter: Mock,
        mock_set: Mock,
        mock_get: Mock,
        request_factory: RequestFactory,
    ) -> None:
        # Setup cache manager mock (cache miss)
        mock_get.return_value = None

        # Setup database query mock - create proper Mock objects with all needed attributes
        mock_row_30 = Mock()
        mock_row_30.number = 30
        mock_row_30.date = date(2023, 12, 1)
        mock_row_30.price = 15000.0
        mock_row_30.fluct_price = 50.0

        mock_row_60 = Mock()
        mock_row_60.number = 60
        mock_row_60.date = date(2023, 12, 1)
        mock_row_60.price = 15050.0
        mock_row_60.fluct_price = 100.0

        mock_market_data = [mock_row_30, mock_row_60]
        mock_filter.return_value = mock_market_data

        request = request_factory.get("/api/stock/market-index/")

        response = market_index(request)

        assert isinstance(response, JsonResponse)
        assert response.status_code == 200

        data = json.loads(response.content)
        assert TradeType.TSE in data
        assert TradeType.OTC in data

        # Verify cache.set was called for each market
        assert mock_set.call_count == 2

    def test_market_index_method_not_allowed(
        self, request_factory: RequestFactory
    ) -> None:
        request = request_factory.post("/api/stock/market-index/")

        # The @require_GET decorator returns a 405 response for disallowed methods
        response = market_index(request)

        # Django's require_GET returns HttpResponseNotAllowed, not JsonResponse
        assert response.status_code == 405


@pytest.mark.django_db
class TestCurrentStockInfoView:
    @pytest.fixture
    def request_factory(self) -> RequestFactory:
        return RequestFactory()

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
    def stock_infos(self, companies: list[Company]) -> list[StockInfo]:
        return [
            StockInfo.objects.create(
                company=companies[0],
                date=date.today(),
                quantity=1000000,
                close_price=100.5,
                fluct_price=2.3,
            ),
            StockInfo.objects.create(
                company=companies[1],
                date=date.today(),
                quantity=2000000,
                close_price=50.25,
                fluct_price=-1.5,
            ),
        ]

    def test_current_stock_info_with_valid_sids(
        self, request_factory: RequestFactory, stock_infos: list[StockInfo]
    ) -> None:
        request = request_factory.get("/api/stock/current-stock-info/?sids=1234,5678")

        response = current_stock_info(request)

        assert isinstance(response, JsonResponse)
        assert response.status_code == 200

        data = json.loads(response.content)
        assert "1234" in data
        assert "5678" in data

        assert data["1234"]["sid"] == "1234"
        assert data["1234"]["name"] == "Company A"
        assert data["1234"]["quantity"] == 1000000
        assert data["1234"]["close"] == 100.5
        assert data["1234"]["fluct_price"] == 2.3

    def test_current_stock_info_with_empty_sids(
        self, request_factory: RequestFactory
    ) -> None:
        request = request_factory.get("/api/stock/current-stock-info/?sids=")

        response = current_stock_info(request)

        assert isinstance(response, JsonResponse)
        assert response.status_code == 200

        data = json.loads(response.content)
        assert data == {}

    def test_current_stock_info_with_nonexistent_sids(
        self, request_factory: RequestFactory, stock_infos: list[StockInfo]
    ) -> None:
        request = request_factory.get("/api/stock/current-stock-info/?sids=9999,8888")

        response = current_stock_info(request)

        assert isinstance(response, JsonResponse)
        assert response.status_code == 200

        data = json.loads(response.content)
        assert data == {}

    def test_current_stock_info_no_sids_parameter(
        self, request_factory: RequestFactory
    ) -> None:
        request = request_factory.get("/api/stock/current-stock-info/")

        response = current_stock_info(request)

        assert isinstance(response, JsonResponse)
        assert response.status_code == 200

        data = json.loads(response.content)
        assert data == {}


@pytest.mark.django_db
class TestHistoricalPricesView:
    @pytest.fixture
    def request_factory(self) -> RequestFactory:
        return RequestFactory()

    @pytest.fixture
    def company(self) -> Company:
        return Company.objects.create(
            stock_id="1234",
            name="Test Company",
            trade_type=TradeType.TSE,
            business="Test business",
        )

    @pytest.fixture
    def history_records(self, company: Company) -> list[History]:
        return [
            History.objects.create(
                company=company,
                frequency=Frequency.DAILY,
                date=date(2023, 12, 1),
                quantity=1000000,
                close_price=100.0,
            ),
            History.objects.create(
                company=company,
                frequency=Frequency.DAILY,
                date=date(2023, 12, 2),
                quantity=1100000,
                close_price=102.5,
            ),
            History.objects.create(
                company=company,
                frequency=Frequency.WEEKLY,
                date=date(2023, 12, 1),
                quantity=5000000,
                close_price=101.0,
            ),
        ]

    def test_historical_prices_default_frequency(
        self, request_factory: RequestFactory, history_records: list[History]
    ) -> None:
        request = request_factory.get("/api/stock/historical-prices/1234/")

        response = historical_prices(request, "1234")

        assert isinstance(response, JsonResponse)
        assert response.status_code == 200

        data = json.loads(response.content)
        assert "data" in data
        assert len(data["data"]) == 2  # Only daily records

        # Check data structure
        for item in data["data"]:
            assert "date" in item
            assert "price" in item

    def test_historical_prices_with_weekly_frequency(
        self, request_factory: RequestFactory, history_records: list[History]
    ) -> None:
        request = request_factory.get(
            f"/api/stock/historical-prices/1234/?frequency={Frequency.WEEKLY}"
        )

        response = historical_prices(request, "1234")

        assert isinstance(response, JsonResponse)
        assert response.status_code == 200

        data = json.loads(response.content)
        assert "data" in data
        assert len(data["data"]) == 1  # Only weekly record

    def test_historical_prices_with_monthly_frequency(
        self, request_factory: RequestFactory, history_records: list[History]
    ) -> None:
        request = request_factory.get(
            f"/api/stock/historical-prices/1234/?frequency={Frequency.MONTHLY}"
        )

        response = historical_prices(request, "1234")

        assert isinstance(response, JsonResponse)
        assert response.status_code == 200

        data = json.loads(response.content)
        assert "data" in data
        assert len(data["data"]) == 0  # No monthly records

    def test_historical_prices_nonexistent_company(
        self, request_factory: RequestFactory
    ) -> None:
        request = request_factory.get("/api/stock/historical-prices/9999/")

        with pytest.raises(ObjectDoesNotExist):
            historical_prices(request, "9999")

    def test_historical_prices_no_history_data(
        self, request_factory: RequestFactory, company: Company
    ) -> None:
        request = request_factory.get("/api/stock/historical-prices/1234/")

        response = historical_prices(request, "1234")

        assert isinstance(response, JsonResponse)
        assert response.status_code == 200

        data = json.loads(response.content)
        assert "data" in data
        assert len(data["data"]) == 0


@pytest.mark.django_db
class TestSearchView:
    @pytest.fixture
    def request_factory(self) -> RequestFactory:
        return RequestFactory()

    @pytest.fixture
    def companies_and_stock_infos(self) -> list[tuple[Company, StockInfo]]:
        companies_data = [
            ("1234", "Taiwan Semiconductor"),
            ("2330", "TSMC Limited"),
            ("5678", "Apple Computer"),
            ("9999", "Microsoft Corp"),
        ]

        result = []
        for sid, name in companies_data:
            company = Company.objects.create(
                stock_id=sid, name=name, trade_type=TradeType.TSE, business="Technology"
            )
            stock_info = StockInfo.objects.create(
                company=company,
                date=date.today(),
                quantity=1000000,
                close_price=100.0,
                fluct_price=2.0,
            )
            result.append((company, stock_info))

        return result

    def test_search_by_stock_id(
        self,
        request_factory: RequestFactory,
        companies_and_stock_infos: list[tuple[Company, StockInfo]],
    ) -> None:
        request = request_factory.get("/api/stock/search/?keyword=1234")

        response = search(request)

        assert isinstance(response, JsonResponse)
        assert response.status_code == 200

        data = json.loads(response.content)
        assert "data" in data
        assert len(data["data"]) == 1
        assert data["data"][0]["sid"] == "1234"
        assert data["data"][0]["name"] == "Taiwan Semiconductor"

    def test_search_by_company_name(
        self,
        request_factory: RequestFactory,
        companies_and_stock_infos: list[tuple[Company, StockInfo]],
    ) -> None:
        request = request_factory.get("/api/stock/search/?keyword=TSMC")

        response = search(request)

        assert isinstance(response, JsonResponse)
        assert response.status_code == 200

        data = json.loads(response.content)
        assert "data" in data
        assert len(data["data"]) == 1
        assert data["data"][0]["sid"] == "2330"
        assert data["data"][0]["name"] == "TSMC Limited"

    def test_search_partial_match(
        self,
        request_factory: RequestFactory,
        companies_and_stock_infos: list[tuple[Company, StockInfo]],
    ) -> None:
        request = request_factory.get("/api/stock/search/?keyword=23")

        response = search(request)

        assert isinstance(response, JsonResponse)
        assert response.status_code == 200

        data = json.loads(response.content)
        assert "data" in data
        # Should match "2330" (stock ID containing "23")
        assert len(data["data"]) >= 1
        assert any(item["sid"] == "2330" for item in data["data"])

    def test_search_case_insensitive(
        self,
        request_factory: RequestFactory,
        companies_and_stock_infos: list[tuple[Company, StockInfo]],
    ) -> None:
        request = request_factory.get("/api/stock/search/?keyword=taiwan")

        response = search(request)

        assert isinstance(response, JsonResponse)
        assert response.status_code == 200

        data = json.loads(response.content)
        assert "data" in data
        assert len(data["data"]) == 1
        assert data["data"][0]["sid"] == "1234"

    def test_search_no_keyword(self, request_factory: RequestFactory) -> None:
        request = request_factory.get("/api/stock/search/")

        response = search(request)

        assert isinstance(response, JsonResponse)
        assert response.status_code == 200

        data = json.loads(response.content)
        assert "data" in data
        assert len(data["data"]) == 0

    def test_search_no_results(
        self,
        request_factory: RequestFactory,
        companies_and_stock_infos: list[tuple[Company, StockInfo]],
    ) -> None:
        request = request_factory.get("/api/stock/search/?keyword=nonexistent")

        response = search(request)

        assert isinstance(response, JsonResponse)
        assert response.status_code == 200

        data = json.loads(response.content)
        assert "data" in data
        assert len(data["data"]) == 0

    def test_search_limit_results(self, request_factory: RequestFactory) -> None:
        # Create more than 30 companies to test the limit
        for i in range(35):
            company = Company.objects.create(
                stock_id=f"TEST{i:02d}",
                name=f"Test Company {i}",
                trade_type=TradeType.TSE,
                business="Test",
            )
            StockInfo.objects.create(
                company=company,
                date=date.today(),
                quantity=1000000,
                close_price=100.0,
                fluct_price=1.0,
            )

        request = request_factory.get("/api/stock/search/?keyword=TEST")

        response = search(request)

        assert isinstance(response, JsonResponse)
        assert response.status_code == 200

        data = json.loads(response.content)
        assert "data" in data
        # Should be limited to 30 results
        assert len(data["data"]) == 30
