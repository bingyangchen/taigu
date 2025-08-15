from typing import Self
from unittest.mock import Mock, patch

import pytest
from pydantic import BaseModel, ValidationError

from main.core.cache import BaseCacheManager


class TestBaseCacheManager:
    class ConcreteCacheManager(BaseCacheManager[str]):
        cache_name = "test"

        class TestValueModel(BaseModel):
            value: str = ""  # Default field to make it accept string inputs

            @classmethod
            def model_validate(cls, value: str) -> "Self":
                # Accept string inputs by wrapping them
                if isinstance(value, str):
                    return cls(value=value)
                return super().model_validate(value)

        value_validator_model = TestValueModel

    @pytest.fixture
    def cache_manager(self) -> ConcreteCacheManager:
        return self.ConcreteCacheManager()

    def test_init(self) -> None:
        manager = self.ConcreteCacheManager()
        assert hasattr(manager, "cache_name")
        assert hasattr(manager, "value_validator_model")

    def test_cache_key_generation(self) -> None:
        manager = self.ConcreteCacheManager()
        # Test the private method directly using name mangling
        cache_key = manager._BaseCacheManager__gen_cache_key("test_id")
        assert cache_key == "test:test_id"

    @patch("main.core.cache.cache")
    def test_get_calls_django_cache_get(
        self, mock_cache: Mock, cache_manager: ConcreteCacheManager
    ) -> None:
        mock_cache.get.return_value = "cached_value"

        result = cache_manager.get("test_id")

        mock_cache.get.assert_called_once_with("test:test_id")
        assert result == "cached_value"

    @patch("main.core.cache.cache")
    def test_get_returns_none_when_cache_miss(
        self,
        mock_cache: Mock,
        cache_manager: ConcreteCacheManager,
    ) -> None:
        mock_cache.get.return_value = None

        result = cache_manager.get("test_id")

        mock_cache.get.assert_called_once_with("test:test_id")
        assert result is None

    @patch("main.core.cache.cache")
    def test_set_calls_django_cache_set(
        self, mock_cache: Mock, cache_manager: ConcreteCacheManager
    ) -> None:
        test_value = "test_value"
        test_timeout = 3600

        cache_manager.set("test_id", test_value, test_timeout)

        mock_cache.set.assert_called_once_with("test:test_id", test_value, test_timeout)

    @patch("main.core.cache.cache")
    def test_set_with_invalid_value(
        self, mock_cache: Mock, cache_manager: ConcreteCacheManager
    ) -> None:
        test_value = 123
        test_timeout = 3600

        with pytest.raises(ValidationError):
            cache_manager.set("test_id", test_value, test_timeout)

    @patch("main.core.cache.cache")
    def test_full_cache_workflow(
        self, mock_cache: Mock, cache_manager: ConcreteCacheManager
    ) -> None:
        test_value = "workflow_test_value"
        test_timeout = 1800

        # Test set operation
        cache_manager.set("test_id", test_value, test_timeout)
        mock_cache.set.assert_called_once_with("test:test_id", test_value, test_timeout)

        # Test get operation
        mock_cache.get.return_value = test_value
        result = cache_manager.get("test_id")

        mock_cache.get.assert_called_once_with("test:test_id")
        assert result == test_value

    @patch("main.core.cache.cache")
    def test_delete_calls_django_cache_delete(
        self, mock_cache: Mock, cache_manager: ConcreteCacheManager
    ) -> None:
        cache_manager.delete("test_id")

        mock_cache.delete.assert_called_once_with("test:test_id")

    @patch("main.core.cache.cache")
    def test_validation_called_before_cache_set(
        self, mock_cache: Mock, cache_manager: ConcreteCacheManager
    ) -> None:
        # Test that validation happens before cache.set is called
        invalid_value = 123  # Should fail validation

        with pytest.raises(ValidationError):
            cache_manager.set("test_id", invalid_value, 3600)

        # Verify cache.set was never called due to validation failure
        mock_cache.set.assert_not_called()
