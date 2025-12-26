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

    def test_point_data_validation(self) -> None:
        # Test strict mode and missing required fields
        with pytest.raises(ValidationError):
            TimeSeriesStockInfoPointData(
                date=date(2023, 12, 1),
                price=100.5,
                fluct_price=2.3,
                extra_field="not_allowed",  # type: ignore
            )

        # Test missing required fields
        with pytest.raises(ValidationError):
            TimeSeriesStockInfoPointData(
                price=100.5,  # type: ignore
                fluct_price=2.3,
            )

        # Test invalid types
        with pytest.raises(ValidationError):
            TimeSeriesStockInfoPointData(
                date="2023-12-01",  # type: ignore
                price=100.5,
                fluct_price=2.3,
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

    def test_time_series_validation(self) -> None:
        # Test strict mode
        with pytest.raises(ValidationError):
            TimeSeriesStockInfo(
                data={},
                extra_field="not_allowed",  # type: ignore
            )

        # Test invalid data type
        with pytest.raises(ValidationError):
            TimeSeriesStockInfo(
                data="invalid_data"  # type: ignore
            )

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


class TestTimeSeriesStockInfoCacheManager:
    @pytest.fixture
    def cache_manager(self) -> TimeSeriesStockInfoCacheManager:
        return TimeSeriesStockInfoCacheManager()

    def test_cache_manager_initialization(
        self, cache_manager: TimeSeriesStockInfoCacheManager
    ) -> None:
        assert cache_manager._value_validator_model == TimeSeriesStockInfo

    def test_cache_manager_inheritance(self) -> None:
        # Test that it inherits from BaseCacheManager
        cache_manager = TimeSeriesStockInfoCacheManager()

        # Should have methods from BaseCacheManager
        assert hasattr(cache_manager, "get")
        assert hasattr(cache_manager, "set")

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
            "TimeSeriesStockInfoCacheManager:test_stock_id", time_series, 300
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

        mock_cache.get.assert_called_once_with(
            "TimeSeriesStockInfoCacheManager:test_stock_id"
        )
        assert result == expected_time_series

    @patch("main.core.cache.cache")
    def test_cache_manager_get_none(
        self, mock_cache: Mock, cache_manager: TimeSeriesStockInfoCacheManager
    ) -> None:
        mock_cache.get.return_value = None

        result = cache_manager.get("test_stock_id")

        mock_cache.get.assert_called_once_with(
            "TimeSeriesStockInfoCacheManager:test_stock_id"
        )
        assert result is None

    @patch("main.core.cache.cache")
    def test_cache_manager_delete_operation(
        self, mock_cache: Mock, cache_manager: TimeSeriesStockInfoCacheManager
    ) -> None:
        cache_manager.delete("test_stock_id")

        mock_cache.delete.assert_called_once_with(
            "TimeSeriesStockInfoCacheManager:test_stock_id"
        )

    @patch("main.core.cache.cache")
    def test_cache_manager_validation_error(
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
            f"TimeSeriesStockInfoCacheManager:{stock_id}", time_series, 300
        )

        # Test get
        mock_cache.get.return_value = time_series
        result = cache_manager.get(stock_id)
        mock_cache.get.assert_called_once_with(
            f"TimeSeriesStockInfoCacheManager:{stock_id}"
        )
        assert result == time_series

        # Test delete
        cache_manager.delete(stock_id)
        mock_cache.delete.assert_called_once_with(
            f"TimeSeriesStockInfoCacheManager:{stock_id}"
        )
