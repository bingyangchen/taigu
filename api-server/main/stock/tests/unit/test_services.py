from datetime import date, time
from typing import Any
from unittest.mock import Mock, patch

import pytest
from requests import ConnectTimeout, JSONDecodeError, ReadTimeout

from main.stock import Frequency, TradeType
from main.stock.models import Company, StockInfo
from main.stock.services import (
    _fetch_and_store_historical_info_from_yahoo,
    _store_market_per_minute_info,
    fetch_and_store_realtime_stock_info,
    roc_date_string_to_date,
    update_all_stocks_history,
    update_company_list,
    update_material_facts,
)


@pytest.mark.django_db
class TestFetchAndStoreRealtimeStockInfo:
    @pytest.fixture
    def mock_companies(self) -> list[Company]:
        companies = []
        for i, trade_type in enumerate([TradeType.TSE, TradeType.OTC]):
            company = Company.objects.create(
                stock_id=f"123{i}",
                name=f"Test Company {i}",
                trade_type=trade_type,
                business="Test business",
            )
            companies.append(company)
        return companies

    @pytest.fixture
    def mock_json_response(self) -> dict[str, Any]:
        return {
            "msgArray": [
                {
                    "c": "1234",
                    "d": "20231201",
                    "v": "1000",
                    "y": "100.0",
                    "z": "102.5",
                    "a": "103.0_103.5",
                    "b": "101.5_102.0",
                    "u": "110.0",
                    "w": "90.0",
                },
                {
                    "c": "t00",
                    "d": "20231201",
                    "v": "5000",
                    "y": "15000.0",
                    "z": "15050.0",
                    "a": "15055.0",
                    "b": "15045.0",
                    "u": "16500.0",
                    "w": "13500.0",
                },
            ]
        }

    @patch("main.stock.services.requests.get")
    @patch("main.stock.services._store_market_per_minute_info")
    @patch("main.stock.services.StockInfo.objects.bulk_create")
    @patch("main.stock.services.Company.objects.filter")
    @patch("main.stock.services.logger")
    def test_fetch_and_store_realtime_stock_info_success(
        self,
        mock_logger: Mock,
        mock_filter: Mock,
        mock_bulk_create: Mock,
        mock_store_market: Mock,
        mock_get: Mock,
        mock_companies: list[Company],
        mock_json_response: dict[str, Any],
    ) -> None:
        # Setup mocks
        mock_filter.return_value.values.return_value = [
            {"pk": "1234", "trade_type": TradeType.TSE}
        ]

        mock_response = Mock()
        mock_response.json.return_value = mock_json_response
        mock_get.return_value = mock_response

        # Mock date.today() to match test data
        with patch("main.stock.services.date") as mock_date:
            mock_date.today.return_value = date(2023, 12, 1)

            fetch_and_store_realtime_stock_info()

        # Verify logger calls
        mock_logger.info.assert_any_call("Start fetching realtime sotck info.")
        mock_logger.info.assert_any_call("All realtime stock info updated!")

        # Verify market info storage for t00
        mock_store_market.assert_called_once_with(
            id="t00", date_=date(2023, 12, 1), price=15050.0, fluct_price=50.0
        )

        # Verify bulk create was called
        mock_bulk_create.assert_called_once()

    @patch("main.stock.services.requests.get")
    @patch("main.stock.services.Company.objects.filter")
    @patch("main.stock.services.logger")
    def test_fetch_and_store_realtime_stock_info_error_handling(
        self, mock_logger: Mock, mock_filter: Mock, mock_get: Mock
    ) -> None:
        mock_filter.return_value.values.return_value = []

        # Test different types of errors
        errors = [ReadTimeout(), ConnectTimeout(), JSONDecodeError("msg", "doc", 0)]

        for error in errors:
            if isinstance(error, JSONDecodeError):
                mock_response = Mock()
                mock_response.json.side_effect = error
                mock_get.return_value = mock_response
            else:
                mock_get.side_effect = error

            fetch_and_store_realtime_stock_info()

            # Verify error was logged
            assert mock_logger.warning.called or mock_logger.error.called

    @patch("main.stock.services.requests.get")
    @patch("main.stock.services.Company.objects.filter")
    @patch("main.stock.services.logger")
    def test_fetch_and_store_realtime_stock_info_invalid_row_data(
        self, mock_logger: Mock, mock_filter: Mock, mock_get: Mock
    ) -> None:
        mock_filter.return_value.values.return_value = []

        invalid_response = {
            "msgArray": [
                {"c": "1234", "d": "invalid_date"}  # Invalid date format
            ]
        }

        mock_response = Mock()
        mock_response.json.return_value = invalid_response
        mock_get.return_value = mock_response

        fetch_and_store_realtime_stock_info()

        # Should log error for invalid row
        assert mock_logger.error.called


@pytest.mark.django_db
class TestStoreMarketPerMinuteInfo:
    @patch("main.stock.services.TimeSeriesStockInfoCacheManager")
    @patch("main.stock.services.MarketIndexPerMinute.objects.get_or_create")
    @patch("main.stock.services.MarketIndexPerMinute.objects.filter")
    def test_store_market_per_minute_info_tse(
        self,
        mock_filter: Mock,
        mock_get_or_create: Mock,
        mock_cache_manager_class: Mock,
    ) -> None:
        mock_delete = Mock()
        mock_delete.delete.return_value = (0, {})
        mock_filter.return_value.exclude.return_value = mock_delete

        mock_cache_manager = Mock()
        mock_cache_manager.get.return_value = None
        mock_cache_manager_class.return_value = mock_cache_manager

        test_date = date(2023, 12, 1)

        # Mock the datetime computation to return 10:30 (90 minutes after 9:00)
        with patch("main.stock.services.datetime") as mock_datetime:
            mock_time_result = Mock()
            mock_time_result.time.return_value = time(10, 30)
            mock_datetime.now.return_value.__add__.return_value = mock_time_result

            _store_market_per_minute_info("t00", test_date, 15000.0, 50.0)

        mock_get_or_create.assert_called_once_with(
            market=TradeType.TSE,
            date=test_date,
            number=90,  # (10-9)*60 + 30
            defaults={"price": 15000.0, "fluct_price": 50.0},
        )

    @patch("main.stock.services.TimeSeriesStockInfoCacheManager")
    @patch("main.stock.services.MarketIndexPerMinute.objects.get_or_create")
    @patch("main.stock.services.MarketIndexPerMinute.objects.filter")
    def test_store_market_per_minute_info_otc(
        self,
        mock_filter: Mock,
        mock_get_or_create: Mock,
        mock_cache_manager_class: Mock,
    ) -> None:
        mock_delete = Mock()
        mock_delete.delete.return_value = (0, {})
        mock_filter.return_value.exclude.return_value = mock_delete

        mock_cache_manager = Mock()
        mock_cache_manager.get.return_value = None
        mock_cache_manager_class.return_value = mock_cache_manager

        test_date = date(2023, 12, 1)

        # Mock the datetime computation to return 10:30 (90 minutes after 9:00)
        with patch("main.stock.services.datetime") as mock_datetime:
            mock_time_result = Mock()
            mock_time_result.time.return_value = time(10, 30)
            mock_datetime.now.return_value.__add__.return_value = mock_time_result

            _store_market_per_minute_info("o00", test_date, 150.0, 2.0)

        mock_get_or_create.assert_called_once_with(
            market=TradeType.OTC,
            date=test_date,
            number=90,
            defaults={"price": 150.0, "fluct_price": 2.0},
        )


@pytest.mark.django_db
class TestUpdateCompanyList:
    @patch("main.stock.services.requests.get")
    @patch("main.stock.services.Company.objects.get_or_create")
    @patch("main.stock.services.Company.objects.filter")
    @patch("main.stock.services.StockInfo.objects.bulk_create")
    @patch("main.stock.services.logger")
    @patch("main.stock.services.sleep")
    def test_update_company_list_success(
        self,
        mock_sleep: Mock,
        mock_logger: Mock,
        mock_bulk_create: Mock,
        mock_filter: Mock,
        mock_get_or_create: Mock,
        mock_get: Mock,
    ) -> None:
        # Mock API responses
        tse_response = [
            {"SecuritiesCompanyCode": "1234"},
            {"SecuritiesCompanyCode": "5678"},
        ]
        otc_response = [{"Code": "9999"}, {"Code": "8888"}]

        mock_get.side_effect = [
            Mock(json=Mock(return_value=tse_response)),
            Mock(json=Mock(return_value=otc_response)),
        ]

        # Mock existing companies
        mock_filter.return_value = []  # No existing companies

        # Mock company creation
        mock_get_or_create.side_effect = [
            (Mock(pk="1234"), True),
            (Mock(pk="5678"), True),
            (Mock(pk="9999"), True),
            (Mock(pk="8888"), True),
        ]

        update_company_list()

        # Verify API calls
        assert mock_get.call_count == 2
        assert mock_get_or_create.call_count == 4
        mock_bulk_create.assert_called_once()
        mock_logger.info.assert_any_call("Start updating company list.")
        mock_logger.info.assert_any_call("Company list updated!")

    @patch("main.stock.services.requests.get")
    @patch("main.stock.services.logger")
    def test_update_company_list_api_error(
        self, mock_logger: Mock, mock_get: Mock
    ) -> None:
        mock_get.side_effect = Exception("API Error")

        update_company_list()

        # Should log the error
        assert mock_logger.error.called


@pytest.mark.django_db
class TestFetchAndStoreHistoricalInfoFromYahoo:
    @pytest.fixture
    def company(self) -> Company:
        return Company.objects.create(
            stock_id="1234",
            name="Test Company",
            trade_type=TradeType.TSE,
            business="Test business",
        )

    @patch("main.stock.services.requests.get")
    @patch("main.stock.services.History.objects.filter")
    @patch("main.stock.services.History.objects.bulk_create")
    def test_fetch_and_store_historical_info_from_yahoo_daily(
        self,
        mock_bulk_create: Mock,
        mock_filter: Mock,
        mock_get: Mock,
        company: Company,
    ) -> None:
        # Mock CSV response
        csv_data = "Date,Open,High,Low,Close,Adj Close,Volume\n2023-11-01,100.0,105.0,95.0,102.0,102.0,1000000\n2023-11-02,102.0,107.0,100.0,105.0,105.0,1200000"
        mock_response = Mock()
        mock_response.text = csv_data
        mock_get.return_value = mock_response

        mock_filter.return_value.delete.return_value = None

        _fetch_and_store_historical_info_from_yahoo(company, Frequency.DAILY)

        # Verify the request was made
        mock_get.assert_called_once()
        # Verify bulk_create was called
        mock_bulk_create.assert_called_once()

    @patch("main.stock.services.requests.get")
    @patch("main.stock.services.History.objects.filter")
    @patch("main.stock.services.History.objects.bulk_create")
    def test_fetch_and_store_historical_info_otc_company(
        self, mock_bulk_create: Mock, mock_filter: Mock, mock_get: Mock
    ) -> None:
        otc_company = Company.objects.create(
            stock_id="5678",
            name="OTC Company",
            trade_type=TradeType.OTC,
            business="OTC business",
        )

        csv_data = "Date,Open,High,Low,Close,Adj Close,Volume\n2023-11-01,100.0,105.0,95.0,102.0,102.0,1000000"
        mock_response = Mock()
        mock_response.text = csv_data
        mock_get.return_value = mock_response

        mock_filter.return_value.delete.return_value = None

        _fetch_and_store_historical_info_from_yahoo(otc_company, Frequency.DAILY)

        # Verify the request URL contains TWO suffix for OTC
        call_args = mock_get.call_args[0][0]
        assert "5678.TWO" in call_args


@pytest.mark.django_db
class TestUpdateAllStocksHistory:
    @pytest.fixture
    def stock_info(self) -> StockInfo:
        company = Company.objects.create(
            stock_id="1234",
            name="Test Company",
            trade_type=TradeType.TSE,
            business="Test business",
        )
        return StockInfo.objects.create(
            company=company,
            date=date.today(),
            quantity=1000000,
            close_price=100.5,
            fluct_price=2.3,
        )

    @patch("main.stock.services.History.objects.bulk_create")
    @patch("main.stock.services.History.objects.filter")
    @patch("main.stock.services.StockInfo.objects.filter")
    def test_update_all_stocks_history(
        self,
        mock_stock_filter: Mock,
        mock_history_filter: Mock,
        mock_bulk_create: Mock,
        stock_info: StockInfo,
    ) -> None:
        mock_stock_filter.return_value.select_related.return_value = [stock_info]
        mock_history_filter.return_value.delete.return_value = None

        update_all_stocks_history()

        mock_bulk_create.assert_called_once()
        mock_history_filter.assert_called_once()


@pytest.mark.django_db
class TestUpdateMaterialFacts:
    @patch("main.stock.services.requests.get")
    @patch("main.stock.services.Company.objects.get_or_create")
    @patch("main.stock.services.Company.objects.filter")
    @patch("main.stock.services.MaterialFact.objects.bulk_create")
    @patch("main.stock.services.MaterialFact.objects.filter")
    @patch("main.stock.services.logger")
    @patch("main.stock.services.sleep")
    def test_update_material_facts_success(
        self,
        mock_sleep: Mock,
        mock_logger: Mock,
        mock_fact_filter: Mock,
        mock_bulk_create: Mock,
        mock_company_filter: Mock,
        mock_get_or_create: Mock,
        mock_get: Mock,
    ) -> None:
        # Mock API responses
        tse_response = [
            {
                "公司代號": "1234",
                "發言日期": "1121130",  # ROC date: 112/11/30
                "發言時間": "143000",  # 14:30:00
                "主旨 ": "Test announcement",
                "說明": "Test description",
            }
        ]
        otc_response = [
            {
                "SecuritiesCompanyCode": "5678",
                "發言日期": "1121201",
                "發言時間": "150000",
                "主旨": "OTC announcement",
                "說明": "OTC description",
            }
        ]

        mock_get.side_effect = [
            Mock(json=Mock(return_value=tse_response)),
            Mock(json=Mock(return_value=otc_response)),
        ]

        # Mock existing companies
        mock_company_filter.return_value.values.return_value = [
            {"pk": "1234"},
            {"pk": "5678"},
        ]

        # Mock delete old records
        mock_fact_filter.return_value.delete.return_value = None

        update_material_facts()

        # Verify bulk_create was called
        assert mock_bulk_create.call_count == 2
        mock_logger.info.assert_any_call("Start fetching material facts.")
        mock_logger.info.assert_any_call("Material facts updated!")

    @patch("main.stock.services.requests.get")
    @patch("main.stock.services.logger")
    def test_update_material_facts_api_error(
        self, mock_logger: Mock, mock_get: Mock
    ) -> None:
        mock_get.side_effect = Exception("API Error")

        update_material_facts()

        # Should log the error
        assert mock_logger.error.called


class TestRocDateStringToDate:
    def test_roc_date_string_to_date_valid(self) -> None:
        # ROC year 112 = 2023
        result = roc_date_string_to_date("1121130")
        expected = date(2023, 11, 30)
        assert result == expected

    def test_roc_date_string_to_date_different_date(self) -> None:
        # ROC year 110 = 2021
        result = roc_date_string_to_date("1100101")
        expected = date(2021, 1, 1)
        assert result == expected

    def test_roc_date_string_to_date_leap_year(self) -> None:
        # ROC year 109 = 2020 (leap year)
        result = roc_date_string_to_date("1090229")
        expected = date(2020, 2, 29)
        assert result == expected

    def test_roc_date_string_to_date_invalid_format(self) -> None:
        # Test with invalid date format - should raise ValueError
        with pytest.raises(ValueError):
            roc_date_string_to_date("invalid")
