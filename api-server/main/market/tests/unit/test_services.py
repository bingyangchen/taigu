from datetime import date, datetime, timedelta
from typing import Any
from unittest.mock import Mock, patch
from zoneinfo import ZoneInfo

import pytest
from requests import ConnectTimeout, JSONDecodeError, ReadTimeout

from main.market import Frequency, TradeType
from main.market.models import (
    Company,
    History,
    MarketIndexHistory,
    MarketIndexPerMinute,
    StockInfo,
    StockPricePerMinute,
)
from main.market.services import (
    _bulk_store_stock_price_per_minute,
    _get_intraday_five_minute_slot,
    _get_minutes_after_opening,
    _store_market_index_per_minute,
    backfill_all_stocks_history,
    fetch_and_store_realtime_stock_info,
    roc_date_string_to_date,
    update_all_stocks_history,
    update_company_list,
    update_market_indices_history,
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
                    "a": "104.0_104.5",
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

    @pytest.mark.scenario("MKT-R2.1")
    @patch("main.market.services._bulk_store_stock_price_per_minute")
    @patch("main.market.services.requests.get")
    @patch("main.market.services._store_market_index_per_minute")
    @patch("main.market.services.StockInfo.objects.bulk_create")
    @patch("main.market.services.Company.objects.filter")
    @patch("main.market.services.logger")
    def test_fetch_and_store_realtime_stock_info_success(
        self,
        mock_logger: Mock,
        mock_filter: Mock,
        mock_bulk_create: Mock,
        mock_store_market: Mock,
        mock_get: Mock,
        mock_store_stock_price: Mock,
        mock_companies: list[Company],
        mock_json_response: dict[str, Any],
    ) -> None:
        mock_filter.return_value.values.return_value = [
            {"pk": "1234", "trade_type": TradeType.TSE}
        ]

        mock_response = Mock()
        mock_response.json.return_value = mock_json_response
        mock_get.return_value = mock_response

        with (
            patch(
                "main.market.services.timezone.localdate",
                return_value=date(2023, 12, 1),
            ),
            patch(
                "main.market.services._get_intraday_five_minute_slot", return_value=90
            ),
        ):
            fetch_and_store_realtime_stock_info()

        mock_logger.info.assert_any_call(
            "Start fetching realtime sotck info. Batch size: %d", 145
        )
        mock_logger.info.assert_any_call("All realtime stock info updated!")

        mock_store_market.assert_called_once_with(
            id="t00", date_=date(2023, 12, 1), price=15050.0, fluct_price=50.0
        )
        mock_bulk_create.assert_called_once()
        mock_store_stock_price.assert_called_once()
        stock_price_batch = mock_store_stock_price.call_args[0][0]
        assert len(stock_price_batch) == 1
        assert stock_price_batch[0].company_id == "1234"
        assert stock_price_batch[0].number == 90
        assert stock_price_batch[0].price == 102.5

    @pytest.mark.scenario("MKT-R6.2")
    @patch("main.market.services._bulk_store_stock_price_per_minute")
    @patch("main.market.services.requests.get")
    @patch("main.market.services._store_market_index_per_minute")
    @patch("main.market.services.StockInfo.objects.bulk_create")
    @patch("main.market.services.Company.objects.filter")
    def test_fetch_passes_empty_stock_price_batch_when_intraday_slot_is_none(
        self,
        mock_filter: Mock,
        mock_bulk_create: Mock,
        mock_store_market: Mock,
        mock_get: Mock,
        mock_store_stock_price: Mock,
        mock_json_response: dict[str, Any],
    ) -> None:
        mock_filter.return_value.values.return_value = [
            {"pk": "1234", "trade_type": TradeType.TSE}
        ]
        mock_response = Mock()
        mock_response.json.return_value = mock_json_response
        mock_get.return_value = mock_response

        with (
            patch(
                "main.market.services.timezone.localdate",
                return_value=date(2023, 12, 1),
            ),
            patch(
                "main.market.services._get_intraday_five_minute_slot", return_value=None
            ),
        ):
            fetch_and_store_realtime_stock_info()

        mock_bulk_create.assert_called_once()
        mock_store_stock_price.assert_called_once()
        assert mock_store_stock_price.call_args[0][0] == []

    @pytest.mark.scenario("MKT-R2.2")
    @patch("main.market.services._bulk_store_stock_price_per_minute")
    @patch("main.market.services.requests.get")
    @patch("main.market.services._store_market_index_per_minute")
    @patch("main.market.services.StockInfo.objects.bulk_create")
    @patch("main.market.services.Company.objects.filter")
    def test_fetch_stores_stock_price_from_bid_ask_without_deal_price(
        self,
        mock_filter: Mock,
        mock_bulk_create: Mock,
        mock_store_market: Mock,
        mock_get: Mock,
        mock_store_stock_price: Mock,
    ) -> None:
        mock_filter.return_value.values.return_value = [
            {"pk": "1234", "trade_type": TradeType.TSE}
        ]
        mock_response = Mock()
        mock_response.json.return_value = {
            "msgArray": [
                {
                    "c": "1234",
                    "d": "20231201",
                    "v": "1000",
                    "y": "100.0",
                    "a": "0.0000_103.0_103.5",
                    "b": "0.0000_101.5_102.0",
                    "u": "110.0",
                    "w": "90.0",
                }
            ]
        }
        mock_get.return_value = mock_response

        with (
            patch(
                "main.market.services.timezone.localdate",
                return_value=date(2023, 12, 1),
            ),
            patch(
                "main.market.services._get_intraday_five_minute_slot", return_value=90
            ),
        ):
            fetch_and_store_realtime_stock_info()

        stock_price_batch = mock_store_stock_price.call_args[0][0]
        assert len(stock_price_batch) == 1
        assert stock_price_batch[0].company_id == "1234"
        assert stock_price_batch[0].number == 90
        assert stock_price_batch[0].price == 102.5
        assert stock_price_batch[0].fluct_price == 2.5

    @patch("main.market.services._bulk_store_stock_price_per_minute")
    @patch("main.market.services.requests.get")
    @patch("main.market.services._store_market_index_per_minute")
    @patch("main.market.services.StockInfo.objects.bulk_create")
    @patch("main.market.services.Company.objects.filter")
    def test_fetch_uses_lower_price_bound_when_ask_has_zero_placeholder(
        self,
        mock_filter: Mock,
        mock_bulk_create: Mock,
        mock_store_market: Mock,
        mock_get: Mock,
        mock_store_stock_price: Mock,
    ) -> None:
        mock_filter.return_value.values.return_value = [
            {"pk": "5274", "trade_type": TradeType.OTC}
        ]
        mock_response = Mock()
        mock_response.json.return_value = {
            "msgArray": [
                {
                    "c": "5274",
                    "d": "20231119",
                    "v": "262",
                    "y": "9700.0",
                    "z": "-",
                    "a": "0.0000_8730.0000_8740.0000_",
                    "b": "-",
                    "u": "10670.0",
                    "w": "8730.0",
                }
            ]
        }
        mock_get.return_value = mock_response

        with (
            patch(
                "main.market.services.timezone.localdate",
                return_value=date(2023, 11, 19),
            ),
            patch(
                "main.market.services._get_intraday_five_minute_slot", return_value=90
            ),
        ):
            fetch_and_store_realtime_stock_info()

        stock_price_batch = mock_store_stock_price.call_args[0][0]
        assert len(stock_price_batch) == 1
        assert stock_price_batch[0].company_id == "5274"
        assert stock_price_batch[0].price == 8730.0
        assert stock_price_batch[0].fluct_price == -970.0

    @pytest.mark.scenario("MKT-R2.5")
    @patch("main.market.services._bulk_store_stock_price_per_minute")
    @patch("main.market.services.requests.get")
    @patch("main.market.services._store_market_index_per_minute")
    @patch("main.market.services.StockInfo.objects.bulk_create")
    @patch("main.market.services.Company.objects.filter")
    def test_fetch_skips_stock_price_when_price_unavailable(
        self,
        mock_filter: Mock,
        mock_bulk_create: Mock,
        mock_store_market: Mock,
        mock_get: Mock,
        mock_store_stock_price: Mock,
    ) -> None:
        mock_filter.return_value.values.return_value = [
            {"pk": "1234", "trade_type": TradeType.TSE}
        ]
        mock_response = Mock()
        mock_response.json.return_value = {
            "msgArray": [
                {
                    "c": "1234",
                    "d": "20231201",
                    "v": "-",
                    "y": "-",
                    "z": "-",
                    "a": "-",
                    "b": "-",
                    "u": "-",
                    "w": "-",
                }
            ]
        }
        mock_get.return_value = mock_response

        with (
            patch(
                "main.market.services.timezone.localdate",
                return_value=date(2023, 12, 1),
            ),
            patch(
                "main.market.services._get_intraday_five_minute_slot", return_value=90
            ),
        ):
            fetch_and_store_realtime_stock_info()

        mock_bulk_create.assert_called_once_with(
            [],
            update_conflicts=True,
            update_fields=["date", "quantity", "close_price", "fluct_price"],
            unique_fields=["company_id"],
        )
        assert mock_store_stock_price.call_args[0][0] == []

    @pytest.mark.scenario("MKT-R4.1")
    @patch("main.market.services._bulk_store_stock_price_per_minute")
    @patch("main.market.services.requests.get")
    @patch("main.market.services._store_market_index_per_minute")
    @patch("main.market.services.StockInfo.objects.bulk_create")
    @patch("main.market.services.Company.objects.filter")
    def test_fetch_skips_stock_price_when_date_not_today(
        self,
        mock_filter: Mock,
        mock_bulk_create: Mock,
        mock_store_market: Mock,
        mock_get: Mock,
        mock_store_stock_price: Mock,
    ) -> None:
        mock_filter.return_value.values.return_value = [
            {"pk": "1234", "trade_type": TradeType.TSE}
        ]
        mock_response = Mock()
        mock_response.json.return_value = {
            "msgArray": [
                {
                    "c": "1234",
                    "d": "20231130",
                    "v": "1000",
                    "y": "100.0",
                    "z": "102.5",
                    "a": "103.0_103.5",
                    "b": "101.5_102.0",
                    "u": "110.0",
                    "w": "90.0",
                }
            ]
        }
        mock_get.return_value = mock_response

        with (
            patch(
                "main.market.services.timezone.localdate",
                return_value=date(2023, 12, 1),
            ),
            patch(
                "main.market.services._get_intraday_five_minute_slot", return_value=90
            ),
        ):
            fetch_and_store_realtime_stock_info()

        mock_bulk_create.assert_called_once_with(
            [],
            update_conflicts=True,
            update_fields=["date", "quantity", "close_price", "fluct_price"],
            unique_fields=["company_id"],
        )
        assert mock_store_stock_price.call_args[0][0] == []

    @pytest.mark.django_db(transaction=True)
    @pytest.mark.scenario("MKT-R2.1")
    @patch("main.market.services.TimeSeriesStockInfoCacheManager.delete_many")
    @patch("main.market.services.requests.get")
    @patch("main.market.services._store_market_index_per_minute")
    @patch("main.market.services.Company.objects.filter")
    def test_fetch_persists_stock_price_per_minute(
        self,
        mock_filter: Mock,
        mock_store_market: Mock,
        mock_get: Mock,
        mock_delete_cache: Mock,
    ) -> None:
        company = Company.objects.create(
            stock_id="1234",
            name="Test Company",
            trade_type=TradeType.TSE,
            business="Test business",
        )
        mock_filter.return_value.values.return_value = [
            {"pk": company.pk, "trade_type": TradeType.TSE}
        ]
        mock_response = Mock()
        mock_response.json.return_value = {
            "msgArray": [
                {
                    "c": company.pk,
                    "d": "20231201",
                    "v": "1000",
                    "y": "100.0",
                    "z": "102.5",
                    "a": "104.0_104.5",
                    "b": "101.5_102.0",
                    "u": "110.0",
                    "w": "90.0",
                }
            ]
        }
        mock_get.return_value = mock_response

        with (
            patch(
                "main.market.services.timezone.localdate",
                return_value=date(2023, 12, 1),
            ),
            patch(
                "main.market.services._get_intraday_five_minute_slot", return_value=90
            ),
        ):
            fetch_and_store_realtime_stock_info()

        record = StockPricePerMinute.objects.get(
            company=company, date=date(2023, 12, 1), number=90
        )
        assert record.price == 102.5
        assert record.fluct_price == 2.5
        mock_delete_cache.assert_called_once_with([company.pk])

    @patch("main.market.services.requests.get")
    @patch("main.market.services.Company.objects.filter")
    @patch("main.market.services.logger")
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

    @patch("main.market.services.requests.get")
    @patch("main.market.services.Company.objects.filter")
    @patch("main.market.services.logger")
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
    @pytest.mark.scenario("MKT-R5.1")
    @patch("main.market.services.TimeSeriesStockInfoCacheManager")
    @patch("main.market.services.MarketIndexPerMinute.objects.get_or_create")
    @patch("main.market.services.MarketIndexPerMinute.objects.filter")
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

        # Mock local time to return 10:30 (90 minutes after 9:00)
        with patch("main.market.services.timezone.localtime") as mock_localtime:
            mock_localtime.return_value = datetime(
                2023, 12, 1, 10, 30, tzinfo=ZoneInfo("Asia/Taipei")
            )

            _store_market_index_per_minute("t00", test_date, 15000.0, 50.0)

        mock_get_or_create.assert_called_once_with(
            market=TradeType.TSE,
            date=test_date,
            number=90,  # (10-9)*60 + 30
            defaults={"price": 15000.0, "fluct_price": 50.0},
        )

    @patch("main.market.services.TimeSeriesStockInfoCacheManager")
    @patch("main.market.services.MarketIndexPerMinute.objects.get_or_create")
    @patch("main.market.services.MarketIndexPerMinute.objects.filter")
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

        # Mock local time to return 10:30 (90 minutes after 9:00)
        with patch("main.market.services.timezone.localtime") as mock_localtime:
            mock_localtime.return_value = datetime(
                2023, 12, 1, 10, 30, tzinfo=ZoneInfo("Asia/Taipei")
            )

            _store_market_index_per_minute("o00", test_date, 150.0, 2.0)

        mock_get_or_create.assert_called_once_with(
            market=TradeType.OTC,
            date=test_date,
            number=90,
            defaults={"price": 150.0, "fluct_price": 2.0},
        )


class TestGetMinutesAfterOpening:
    @pytest.mark.parametrize(
        ("hour", "minute", "expected"),
        [(9, 0, 0), (10, 30, 90), (13, 30, 270), (14, 0, 270)],
    )
    def test_get_minutes_after_opening(
        self, hour: int, minute: int, expected: int | None
    ) -> None:
        now = datetime(2023, 12, 1, hour, minute, tzinfo=ZoneInfo("Asia/Taipei"))
        assert _get_minutes_after_opening(now) == expected


class TestGetIntradayFiveMinuteSlot:
    @pytest.mark.scenario("MKT-R6.1", "MKT-R6.2")
    @pytest.mark.parametrize(
        ("hour", "minute", "expected"),
        [
            (8, 30, None),
            (8, 59, None),
            (9, 0, 0),
            (9, 3, 5),
            (10, 30, 90),
            (13, 25, 265),
            (13, 29, 270),
            (13, 30, 270),
            (13, 45, None),
            (14, 0, 270),
        ],
    )
    def test_get_intraday_five_minute_slot(
        self, hour: int, minute: int, expected: int | None
    ) -> None:
        now = datetime(2023, 12, 1, hour, minute, tzinfo=ZoneInfo("Asia/Taipei"))
        assert _get_intraday_five_minute_slot(now) == expected


@pytest.mark.django_db
class TestBulkStoreStockPricePerMinute:
    @pytest.fixture
    def company(self) -> Company:
        return Company.objects.create(
            stock_id="2330", name="台積電", trade_type=TradeType.TSE, business="半導體"
        )

    @pytest.mark.scenario("MKT-R6.1")
    @patch("main.market.services.TimeSeriesStockInfoCacheManager.delete_many")
    def test_bulk_store_stock_price_per_minute_upserts_same_day_and_invalidates_cache(
        self, mock_delete_cache: Mock, company: Company
    ) -> None:
        test_date = date(2023, 12, 1)
        _bulk_store_stock_price_per_minute(
            [
                StockPricePerMinute(
                    company_id=company.pk,
                    date=test_date,
                    number=90,
                    price=600.0,
                    fluct_price=5.0,
                )
            ]
        )

        record = StockPricePerMinute.objects.get(
            company=company, date=test_date, number=90
        )
        assert record.price == 600.0
        assert record.fluct_price == 5.0

        _bulk_store_stock_price_per_minute(
            [
                StockPricePerMinute(
                    company_id=company.pk,
                    date=test_date,
                    number=90,
                    price=605.0,
                    fluct_price=10.0,
                )
            ]
        )

        record.refresh_from_db()
        assert record.price == 605.0
        assert record.fluct_price == 10.0
        assert StockPricePerMinute.objects.count() == 1
        assert mock_delete_cache.call_count == 2
        mock_delete_cache.assert_called_with([company.pk])

    @pytest.mark.scenario("MKT-R7.1")
    @patch("main.market.services.TimeSeriesStockInfoCacheManager.delete_many")
    def test_bulk_store_stock_price_per_minute_deletes_stale_date_and_cache(
        self, mock_delete_cache: Mock, company: Company
    ) -> None:
        previous_date = date(2023, 11, 30)
        trading_date = date(2023, 12, 1)
        StockPricePerMinute.objects.create(
            company=company, date=previous_date, number=90, price=590.0, fluct_price=3.0
        )

        _bulk_store_stock_price_per_minute(
            [
                StockPricePerMinute(
                    company_id=company.pk,
                    date=trading_date,
                    number=90,
                    price=600.0,
                    fluct_price=5.0,
                )
            ]
        )

        assert not StockPricePerMinute.objects.filter(date=previous_date).exists()
        record = StockPricePerMinute.objects.get(
            company=company, date=trading_date, number=90
        )
        assert record.price == 600.0
        mock_delete_cache.assert_called_once_with([company.pk])

    @pytest.mark.scenario("MKT-R7.1")
    @patch("main.market.services.TimeSeriesStockInfoCacheManager.delete_many")
    def test_bulk_store_stock_price_per_minute_deletes_stale_dates_in_bulk(
        self, mock_delete_cache: Mock
    ) -> None:
        previous_date = date(2023, 11, 30)
        trading_date = date(2023, 12, 1)
        companies = [
            Company.objects.create(
                stock_id="2330",
                name="台積電",
                trade_type=TradeType.TSE,
                business="半導體",
            ),
            Company.objects.create(
                stock_id="2317", name="鴻海", trade_type=TradeType.TSE, business="電子"
            ),
        ]
        for company in companies:
            StockPricePerMinute.objects.create(
                company=company,
                date=previous_date,
                number=90,
                price=100.0,
                fluct_price=1.0,
            )

        _bulk_store_stock_price_per_minute(
            [
                StockPricePerMinute(
                    company_id=company.pk,
                    date=trading_date,
                    number=90,
                    price=200.0,
                    fluct_price=2.0,
                )
                for company in companies
            ]
        )

        assert StockPricePerMinute.objects.filter(date=previous_date).count() == 0
        assert StockPricePerMinute.objects.filter(date=trading_date).count() == 2
        mock_delete_cache.assert_called_once()
        assert set(mock_delete_cache.call_args[0][0]) == {
            company.pk for company in companies
        }

    @patch("main.market.services.TimeSeriesStockInfoCacheManager.delete_many")
    def test_bulk_store_stock_price_per_minute_skips_empty_batch(
        self, mock_delete_cache: Mock
    ) -> None:
        _bulk_store_stock_price_per_minute([])
        mock_delete_cache.assert_not_called()


@pytest.mark.django_db
class TestUpdateCompanyList:
    @patch("main.market.services.requests.get")
    @patch("main.market.services.Company.objects.get_or_create")
    @patch("main.market.services.Company.objects.filter")
    @patch("main.market.services.StockInfo.objects.bulk_create")
    @patch("main.market.services.logger")
    @patch("main.market.services.sleep")
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

    @patch("main.market.services.requests.get")
    @patch("main.market.services.logger")
    def test_update_company_list_api_error(
        self, mock_logger: Mock, mock_get: Mock
    ) -> None:
        mock_get.side_effect = Exception("API Error")

        update_company_list()

        # Should log the error
        assert mock_logger.error.called


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

    @pytest.mark.scenario("MKT-R8.1")
    @pytest.mark.django_db
    def test_update_market_indices_history(self) -> None:
        today = date.today()
        MarketIndexPerMinute.objects.create(
            market=TradeType.TSE,
            date=today,
            number=270,
            price=15000.0,
            fluct_price=50.0,
        )
        MarketIndexPerMinute.objects.create(
            market=TradeType.OTC, date=today, number=270, price=220.0, fluct_price=1.5
        )

        update_market_indices_history()

        assert MarketIndexHistory.objects.filter(market=TradeType.TSE).count() == 1
        assert MarketIndexHistory.objects.filter(market=TradeType.OTC).count() == 1
        tse_history = MarketIndexHistory.objects.get(market=TradeType.TSE)
        assert tse_history.close_price == 15000.0

    @patch("main.market.services.update_market_indices_history")
    @patch("main.market.services.History.objects.bulk_create")
    @patch("main.market.services.History.objects.filter")
    @patch("main.market.services.StockInfo.objects.filter")
    def test_update_all_stocks_history(
        self,
        mock_stock_filter: Mock,
        mock_history_filter: Mock,
        mock_bulk_create: Mock,
        mock_update_market_indices_history: Mock,
        stock_info: StockInfo,
    ) -> None:
        mock_stock_filter.return_value.select_related.return_value = [stock_info]
        mock_history_filter.return_value.delete.return_value = None

        update_all_stocks_history()

        mock_bulk_create.assert_called_once()
        mock_history_filter.assert_called_once()
        mock_update_market_indices_history.assert_called_once()

    @pytest.mark.scenario("MKT-R9.1")
    @patch("main.market.services.timezone.localdate", return_value=date(2026, 10, 21))
    def test_deletes_closes_older_than_365_days(self, _mock_localdate: Mock) -> None:
        company = Company.objects.create(stock_id="2330", trade_type=TradeType.TSE)
        for day in (date(2025, 10, 20), date(2025, 10, 21)):
            History.objects.create(
                company=company,
                frequency=Frequency.DAILY,
                date=day,
                quantity=0,
                close_price=900.0,
            )
        MarketIndexHistory.objects.create(
            market=TradeType.TSE, date=date(2025, 9, 16), close_price=15000.0
        )

        update_all_stocks_history()

        assert list(
            History.objects.filter(company=company).values_list("date", flat=True)
        ) == [date(2025, 10, 21)]
        assert MarketIndexHistory.objects.filter(
            market=TradeType.TSE, date=date(2025, 9, 16)
        ).exists()


def _make_daily_quotes_response(payload: dict) -> Mock:
    response = Mock()
    response.json.return_value = payload
    return response


def _make_otc_quotes_response(rows: list[list[str]]) -> Mock:
    return _make_daily_quotes_response(
        {
            "stat": "ok",
            "tables": [{"fields": ["代號", "名稱", "收盤", "成交股數"], "data": rows}],
        }
    )


_TWSE_CLOSED_RESPONSE = {"stat": "很抱歉，沒有符合條件的資料!"}


@pytest.mark.django_db
@patch("main.market.services.sleep")
@patch("main.market.services.timezone.localdate", return_value=date(2026, 10, 21))
@patch("main.market.services._HISTORY_RETENTION", timedelta(days=2))
class TestBackfillAllStocksHistory:
    @pytest.fixture(autouse=True)
    def companies(self) -> None:
        Company.objects.create(stock_id="2330", trade_type=TradeType.TSE)
        Company.objects.create(stock_id="2317", trade_type=TradeType.TSE)
        Company.objects.create(stock_id="6488", trade_type=TradeType.OTC)

    @patch("main.market.services.requests.get")
    def test_fills_in_missing_closes(
        self, mock_get: Mock, _mock_localdate: Mock, mock_sleep: Mock
    ) -> None:
        """Only the missing closes are fetched, so a rerun is cheap and never
        replaces a close the daily cron job stored."""
        History.objects.create(
            company_id="2330",
            frequency=Frequency.DAILY,
            date=date(2026, 10, 19),
            quantity=1,
            close_price=1.0,
        )
        date_to_response = {
            "20261020": _make_daily_quotes_response(
                {
                    "stat": "OK",
                    "tables": [
                        {"fields": ["指數", "收盤指數"], "data": [["加權", "23,000"]]},
                        {
                            "fields": ["證券代號", "證券名稱", "成交股數", "收盤價"],
                            "data": [
                                ["2330", "台積電", "26,130,506", "1,440.00"],
                                ["2317", "鴻海", "0", "--"],
                                ["0050", "元大台灣50", "68,386", "62.35"],
                            ],
                        },
                    ],
                }
            ),
            "2026/10/19": _make_otc_quotes_response([]),
            "2026/10/20": _make_otc_quotes_response(
                [["6488 ", "環球晶", "376.00", "1,761,566"]]
            ),
        }
        mock_get.side_effect = lambda _url, params, timeout: date_to_response[
            params["date"]
        ]

        assert backfill_all_stocks_history() == []

        assert sorted(
            History.objects.values_list("company_id", "date", "quantity", "close_price")
        ) == [
            ("2330", date(2026, 10, 19), 1, 1.0),
            ("2330", date(2026, 10, 20), 26130506, 1440.0),
            ("6488", date(2026, 10, 20), 1761566, 376.0),
        ]
        assert mock_get.call_count == 3
        assert mock_sleep.call_count == 3

    @patch("main.market.services.requests.get")
    def test_treats_a_date_twse_has_no_data_for_as_closed(
        self, mock_get: Mock, _mock_localdate: Mock, _mock_sleep: Mock
    ) -> None:
        mock_get.side_effect = [
            _make_daily_quotes_response(_TWSE_CLOSED_RESPONSE),
            _make_otc_quotes_response([]),
        ] * 2

        assert backfill_all_stocks_history() == []

        assert not History.objects.exists()

    @patch("main.market.services.requests.get")
    def test_reports_failed_requests_and_keeps_going(
        self, mock_get: Mock, _mock_localdate: Mock, _mock_sleep: Mock
    ) -> None:
        """A rerun fills in what failed, so one failed request must not stop the
        rest of the year from being fetched."""
        not_json = Mock()
        not_json.json.side_effect = JSONDecodeError("Expecting value", "", 0)
        otc_quotes = _make_otc_quotes_response([["6488", "環球晶", "376.00", "1,000"]])
        mock_get.side_effect = [ReadTimeout(), otc_quotes, not_json, otc_quotes]

        assert backfill_all_stocks_history() == [
            (TradeType.TSE, date(2026, 10, 19)),
            (TradeType.TSE, date(2026, 10, 20)),
        ]

        assert sorted(History.objects.values_list("company_id", "date")) == [
            ("6488", date(2026, 10, 19)),
            ("6488", date(2026, 10, 20)),
        ]

    @pytest.mark.parametrize(
        "payload",
        [
            {"stat": "OK", "tables": [{"fields": ["指數"], "data": [["加權"]]}]},
            {"stat": "查詢日期大於今日，請重新查詢!"},
        ],
    )
    @patch("main.market.services.requests.get")
    def test_stops_at_a_response_in_an_unknown_format(
        self, mock_get: Mock, _mock_localdate: Mock, _mock_sleep: Mock, payload: dict
    ) -> None:
        """A rerun cannot fix a changed format, so the backfill stops instead of
        logging the same failure for every date."""
        mock_get.return_value = _make_daily_quotes_response(payload)

        with pytest.raises(ValueError, match="Unexpected response|No table"):
            backfill_all_stocks_history()


@pytest.mark.django_db
class TestUpdateMaterialFacts:
    @patch("main.market.services.requests.get")
    @patch("main.market.services.Company.objects.get_or_create")
    @patch("main.market.services.Company.objects.filter")
    @patch("main.market.services.MaterialFact.objects.bulk_create")
    @patch("main.market.services.MaterialFact.objects.filter")
    @patch("main.market.services.logger")
    @patch("main.market.services.sleep")
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

    @patch("main.market.services.requests.get")
    @patch("main.market.services.logger")
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
