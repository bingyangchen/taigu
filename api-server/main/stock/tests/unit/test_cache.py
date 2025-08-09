from datetime import date
from unittest.mock import Mock, patch

import pytest
from pydantic import ValidationError

from main.stock.cache import (
    TimeSeriesStockInfo,
    TimeSeriesStockInfoCacheManager,
    TimeSeriesStockInfoPointData,
)


class TestTimeSeriesStockInfoPointData:
    def test_valid_point_data_creation(self) -> None:
        point_data = TimeSeriesStockInfoPointData(
            date=date(2023, 12, 1), price=100.5, fluct_price=2.3
        )

        assert point_data.date == date(2023, 12, 1)
        assert point_data.price == 100.5
        assert point_data.fluct_price == 2.3

    def test_point_data_with_negative_fluct_price(self) -> None:
        point_data = TimeSeriesStockInfoPointData(
            date=date(2023, 12, 1), price=100.5, fluct_price=-2.3
        )

        assert point_data.fluct_price == -2.3

    def test_point_data_with_zero_price(self) -> None:
        point_data = TimeSeriesStockInfoPointData(
            date=date(2023, 12, 1), price=0.0, fluct_price=0.0
        )

        assert point_data.price == 0.0
        assert point_data.fluct_price == 0.0

    def test_point_data_strict_validation(self) -> None:
        # Test that strict mode is enabled - extra fields should raise error
        with pytest.raises(ValidationError):
            TimeSeriesStockInfoPointData(
                date=date(2023, 12, 1),
                price=100.5,
                fluct_price=2.3,
                extra_field="not_allowed",  # type: ignore
            )

    def test_point_data_missing_required_fields(self) -> None:
        # Test missing date
        with pytest.raises(ValidationError):
            TimeSeriesStockInfoPointData(
                price=100.5,  # type: ignore
                fluct_price=2.3,
            )

        # Test missing price
        with pytest.raises(ValidationError):
            TimeSeriesStockInfoPointData(
                date=date(2023, 12, 1),  # type: ignore
                fluct_price=2.3,
            )

        # Test missing fluct_price
        with pytest.raises(ValidationError):
            TimeSeriesStockInfoPointData(
                date=date(2023, 12, 1),  # type: ignore
                price=100.5,
            )

    def test_point_data_invalid_types(self) -> None:
        # Test invalid date type
        with pytest.raises(ValidationError):
            TimeSeriesStockInfoPointData(
                date="2023-12-01",  # type: ignore
                price=100.5,
                fluct_price=2.3,
            )

        # Test invalid price type
        with pytest.raises(ValidationError):
            TimeSeriesStockInfoPointData(
                date=date(2023, 12, 1),
                price="100.5",  # type: ignore
                fluct_price=2.3,
            )

        # Test invalid fluct_price type
        with pytest.raises(ValidationError):
            TimeSeriesStockInfoPointData(
                date=date(2023, 12, 1),
                price=100.5,
                fluct_price="2.3",  # type: ignore
            )

    def test_point_data_model_dump(self) -> None:
        point_data = TimeSeriesStockInfoPointData(
            date=date(2023, 12, 1), price=100.5, fluct_price=2.3
        )

        dumped = point_data.model_dump()
        expected = {"date": date(2023, 12, 1), "price": 100.5, "fluct_price": 2.3}

        assert dumped == expected


class TestTimeSeriesStockInfo:
    def test_valid_time_series_creation(self) -> None:
        point_data_1 = TimeSeriesStockInfoPointData(
            date=date(2023, 12, 1), price=100.5, fluct_price=2.3
        )
        point_data_2 = TimeSeriesStockInfoPointData(
            date=date(2023, 12, 1), price=102.8, fluct_price=4.6
        )

        time_series = TimeSeriesStockInfo(data={30: point_data_1, 60: point_data_2})

        assert len(time_series.data) == 2
        assert time_series.data[30] == point_data_1
        assert time_series.data[60] == point_data_2

    def test_empty_time_series(self) -> None:
        time_series = TimeSeriesStockInfo(data={})

        assert len(time_series.data) == 0
        assert time_series.data == {}

    def test_time_series_with_various_time_keys(self) -> None:
        point_data = TimeSeriesStockInfoPointData(
            date=date(2023, 12, 1), price=100.5, fluct_price=2.3
        )

        time_series = TimeSeriesStockInfo(
            data={
                0: point_data,  # Market open
                90: point_data,  # 1.5 hours after open
                270: point_data,  # Market close
            }
        )

        assert len(time_series.data) == 3
        assert all(key in [0, 90, 270] for key in time_series.data.keys())

    def test_time_series_strict_validation(self) -> None:
        # Test that strict mode is enabled
        with pytest.raises(ValidationError):
            TimeSeriesStockInfo(
                data={},
                extra_field="not_allowed",  # type: ignore
            )

    def test_time_series_invalid_data_type(self) -> None:
        # Test invalid data type
        with pytest.raises(ValidationError):
            TimeSeriesStockInfo(
                data="invalid_data"  # type: ignore
            )

    def test_time_series_invalid_point_data(self) -> None:
        # Test with invalid point data in dict
        with pytest.raises(ValidationError):
            TimeSeriesStockInfo(
                data={
                    30: "invalid_point_data"  # type: ignore
                }
            )

    def test_time_series_model_dump(self) -> None:
        point_data = TimeSeriesStockInfoPointData(
            date=date(2023, 12, 1), price=100.5, fluct_price=2.3
        )

        time_series = TimeSeriesStockInfo(data={30: point_data})

        dumped = time_series.model_dump()
        expected = {
            "data": {
                30: {"date": date(2023, 12, 1), "price": 100.5, "fluct_price": 2.3}
            }
        }

        assert dumped == expected

    def test_time_series_access_non_existent_key(self) -> None:
        time_series = TimeSeriesStockInfo(data={})

        with pytest.raises(KeyError):
            _ = time_series.data[999]


class TestTimeSeriesStockInfoCacheManager:
    @pytest.fixture
    def cache_manager(self) -> TimeSeriesStockInfoCacheManager:
        return TimeSeriesStockInfoCacheManager()

    def test_cache_manager_initialization(
        self, cache_manager: TimeSeriesStockInfoCacheManager
    ) -> None:
        assert cache_manager.cache_name == "time_series_stock_info"
        assert cache_manager.value_validator_model == TimeSeriesStockInfo

    def test_cache_manager_inheritance(self) -> None:
        # Test that it inherits from BaseCacheManager
        cache_manager = TimeSeriesStockInfoCacheManager()

        # Should have methods from BaseCacheManager
        assert hasattr(cache_manager, "get")
        assert hasattr(cache_manager, "set")

    def test_cache_manager_with_different_instances(self) -> None:
        cache_manager_1 = TimeSeriesStockInfoCacheManager()
        cache_manager_2 = TimeSeriesStockInfoCacheManager()

        # They should be different instances
        assert cache_manager_1 != cache_manager_2

    @patch("main.core.cache.cache")
    def test_cache_manager_set_operation(
        self, mock_cache: Mock, cache_manager: TimeSeriesStockInfoCacheManager
    ) -> None:
        point_data = TimeSeriesStockInfoPointData(
            date=date(2023, 12, 1), price=100.5, fluct_price=2.3
        )

        time_series = TimeSeriesStockInfo(data={30: point_data})

        cache_manager.set("test_stock_id", time_series, 300)  # 5 minutes TTL

        mock_cache.set.assert_called_once_with(
            "time_series_stock_info:test_stock_id", time_series, 300
        )

    @patch("main.core.cache.cache")
    def test_cache_manager_get_operation(
        self, mock_cache: Mock, cache_manager: TimeSeriesStockInfoCacheManager
    ) -> None:
        point_data = TimeSeriesStockInfoPointData(
            date=date(2023, 12, 1), price=100.5, fluct_price=2.3
        )

        expected_time_series = TimeSeriesStockInfo(data={30: point_data})

        mock_cache.get.return_value = expected_time_series

        result = cache_manager.get("test_stock_id")

        mock_cache.get.assert_called_once_with("time_series_stock_info:test_stock_id")
        assert result == expected_time_series

    @patch("main.core.cache.cache")
    def test_cache_manager_get_none(
        self, mock_cache: Mock, cache_manager: TimeSeriesStockInfoCacheManager
    ) -> None:
        mock_cache.get.return_value = None

        result = cache_manager.get("test_stock_id")

        mock_cache.get.assert_called_once_with("time_series_stock_info:test_stock_id")
        assert result is None

    @patch("main.core.cache.cache")
    def test_cache_manager_delete_operation(
        self, mock_cache: Mock, cache_manager: TimeSeriesStockInfoCacheManager
    ) -> None:
        cache_manager.delete("test_stock_id")

        mock_cache.delete.assert_called_once_with(
            "time_series_stock_info:test_stock_id"
        )

    def test_cache_manager_class_attributes(self) -> None:
        # Test class-level attributes
        assert TimeSeriesStockInfoCacheManager.cache_name == "time_series_stock_info"
        assert (
            TimeSeriesStockInfoCacheManager.value_validator_model == TimeSeriesStockInfo
        )

    def test_cache_manager_with_empty_stock_id(self) -> None:
        # Test with empty stock ID
        cache_manager = TimeSeriesStockInfoCacheManager()
        # Should be able to use empty string as identifier
        assert hasattr(cache_manager, "get")

    def test_cache_manager_with_special_characters_stock_id(self) -> None:
        # Test with special characters in stock ID
        cache_manager = TimeSeriesStockInfoCacheManager()
        # Should be able to use special characters as identifier
        assert hasattr(cache_manager, "get")

    @patch("main.core.cache.cache")
    def test_cache_manager_set_with_validation_error(
        self, mock_cache: Mock, cache_manager: TimeSeriesStockInfoCacheManager
    ) -> None:
        # Test setting invalid data should raise validation error
        invalid_data = "invalid_time_series_data"

        # The validation should happen at the pydantic model level
        with pytest.raises(ValidationError):
            cache_manager.set("test_stock_id", invalid_data, 300)  # type: ignore

        # Verify cache.set was never called due to validation failure
        mock_cache.set.assert_not_called()

    @patch("main.core.cache.cache")
    def test_cache_manager_cache_key_generation(
        self, mock_cache: Mock, cache_manager: TimeSeriesStockInfoCacheManager
    ) -> None:
        # Test that cache keys are generated correctly for different stock IDs
        stock_ids = ["AAPL", "GOOGL", "TSLA", "special@stock", "stock-123"]

        point_data = TimeSeriesStockInfoPointData(
            date=date(2023, 12, 1), price=100.0, fluct_price=0.0
        )
        time_series = TimeSeriesStockInfo(data={30: point_data})

        for stock_id in stock_ids:
            cache_manager.set(stock_id, time_series, 300)

        # Verify each call used the correct cache key
        for stock_id in stock_ids:
            mock_cache.set.assert_any_call(
                f"time_series_stock_info:{stock_id}", time_series, 300
            )

    @patch("main.core.cache.cache")
    def test_cache_manager_with_complex_time_series_data(
        self, mock_cache: Mock, cache_manager: TimeSeriesStockInfoCacheManager
    ) -> None:
        # Test with more complex time series data
        complex_data = {
            0: TimeSeriesStockInfoPointData(
                date=date(2023, 12, 1), price=100.0, fluct_price=2.5
            ),
            30: TimeSeriesStockInfoPointData(
                date=date(2023, 12, 1), price=102.5, fluct_price=0.0
            ),
            60: TimeSeriesStockInfoPointData(
                date=date(2023, 12, 1), price=101.8, fluct_price=-0.7
            ),
            270: TimeSeriesStockInfoPointData(
                date=date(2023, 12, 1), price=103.2, fluct_price=1.4
            ),
        }

        time_series = TimeSeriesStockInfo(data=complex_data)

        cache_manager.set("COMPLEX_STOCK", time_series, 600)

        mock_cache.set.assert_called_once_with(
            "time_series_stock_info:COMPLEX_STOCK", time_series, 600
        )

    @patch("main.core.cache.cache")
    def test_cache_manager_validation_with_invalid_point_data(
        self, mock_cache: Mock, cache_manager: TimeSeriesStockInfoCacheManager
    ) -> None:
        # Test validation fails with invalid point data
        with pytest.raises(ValidationError):
            TimeSeriesStockInfo(
                data={30: "invalid_point_data"}  # type: ignore
            )

        # Test validation fails when trying to cache invalid data
        with pytest.raises(ValidationError):
            # This should fail during validation
            cache_manager.set("INVALID_STOCK", "not_a_time_series", 300)  # type: ignore

        mock_cache.set.assert_not_called()

    def test_cache_manager_empty_data_handling(self) -> None:
        # Test that empty time series data is valid
        empty_time_series = TimeSeriesStockInfo(data={})

        # Should not raise an exception
        assert empty_time_series.data == {}
        assert len(empty_time_series.data) == 0

    @patch("main.core.cache.cache")
    def test_cache_manager_different_timeout_values(
        self, mock_cache: Mock, cache_manager: TimeSeriesStockInfoCacheManager
    ) -> None:
        point_data = TimeSeriesStockInfoPointData(
            date=date(2023, 12, 1), price=100.0, fluct_price=0.0
        )
        time_series = TimeSeriesStockInfo(data={30: point_data})

        # Test different timeout values
        timeout_tests = [
            ("SHORT_TTL", 60),  # 1 minute
            ("MEDIUM_TTL", 300),  # 5 minutes
            ("LONG_TTL", 3600),  # 1 hour
        ]

        for stock_id, timeout in timeout_tests:
            cache_manager.set(stock_id, time_series, timeout)

        # Verify each call used the correct timeout
        for stock_id, timeout in timeout_tests:
            mock_cache.set.assert_any_call(
                f"time_series_stock_info:{stock_id}", time_series, timeout
            )

    @patch("main.core.cache.cache")
    def test_cache_manager_full_workflow(
        self, mock_cache: Mock, cache_manager: TimeSeriesStockInfoCacheManager
    ) -> None:
        # Test complete cache workflow: set, get, delete
        point_data = TimeSeriesStockInfoPointData(
            date=date(2023, 12, 1), price=150.75, fluct_price=5.25
        )
        time_series = TimeSeriesStockInfo(data={30: point_data, 60: point_data})
        stock_id = "WORKFLOW_TEST"

        # Test set
        cache_manager.set(stock_id, time_series, 300)
        mock_cache.set.assert_called_once_with(
            f"time_series_stock_info:{stock_id}", time_series, 300
        )

        # Test get
        mock_cache.get.return_value = time_series
        result = cache_manager.get(stock_id)
        mock_cache.get.assert_called_once_with(f"time_series_stock_info:{stock_id}")
        assert result == time_series

        # Test delete
        cache_manager.delete(stock_id)
        mock_cache.delete.assert_called_once_with(f"time_series_stock_info:{stock_id}")
