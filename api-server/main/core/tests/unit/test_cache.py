from typing import Any, Self
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
        return self.ConcreteCacheManager(identifier="test_id")

    def test_init(self) -> None:
        manager = self.ConcreteCacheManager(identifier="test_identifier")
        assert manager.identifier == "test_identifier"

    def test_cache_key_generation(self) -> None:
        manager = self.ConcreteCacheManager(identifier="test_id")
        # Test the private method directly using name mangling
        cache_key = manager._BaseCacheManager__gen_cache_key()
        assert cache_key == "test:test_id"

    @patch("main.core.cache.cache")
    def test_get_calls_django_cache_get(
        self, mock_cache: Mock, cache_manager: ConcreteCacheManager
    ) -> None:
        mock_cache.get.return_value = "cached_value"

        result = cache_manager.get()

        mock_cache.get.assert_called_once_with("test:test_id")
        assert result == "cached_value"

    @patch("main.core.cache.cache")
    def test_get_returns_none_when_cache_miss(
        self,
        mock_cache: Mock,
        cache_manager: ConcreteCacheManager,
    ) -> None:
        mock_cache.get.return_value = None

        result = cache_manager.get()

        mock_cache.get.assert_called_once_with("test:test_id")
        assert result is None

    @patch("main.core.cache.cache")
    def test_set_calls_django_cache_set(
        self, mock_cache: Mock, cache_manager: ConcreteCacheManager
    ) -> None:
        test_value = "test_value"
        test_timeout = 3600

        cache_manager.set(test_value, test_timeout)

        mock_cache.set.assert_called_once_with("test:test_id", test_value, test_timeout)

    @patch("main.core.cache.cache")
    def test_set_with_different_timeout(
        self, mock_cache: Mock, cache_manager: ConcreteCacheManager
    ) -> None:
        test_value = "another_value"
        test_timeout = 7200

        cache_manager.set(test_value, test_timeout)

        mock_cache.set.assert_called_once_with("test:test_id", test_value, test_timeout)

    @patch("main.core.cache.cache")
    def test_set_with_invalid_value(
        self, mock_cache: Mock, cache_manager: ConcreteCacheManager
    ) -> None:
        test_value = 123
        test_timeout = 3600

        with pytest.raises(ValidationError):
            cache_manager.set(test_value, test_timeout)

    def test_concrete_implementation_gen_cache_key(self) -> None:
        manager = self.ConcreteCacheManager(identifier="my_test_id")

        cache_key = manager._BaseCacheManager__gen_cache_key()

        assert cache_key == "test:my_test_id"

    @patch("main.core.cache.cache")
    def test_full_cache_workflow(
        self, mock_cache: Mock, cache_manager: ConcreteCacheManager
    ) -> None:
        test_value = "workflow_test_value"
        test_timeout = 1800

        # Test set operation
        cache_manager.set(test_value, test_timeout)
        mock_cache.set.assert_called_once_with("test:test_id", test_value, test_timeout)

        # Test get operation
        mock_cache.get.return_value = test_value
        result = cache_manager.get()

        mock_cache.get.assert_called_once_with("test:test_id")
        assert result == test_value

    def test_type_safety_with_different_types(self) -> None:
        # Test with integer type
        class IntCacheManager(BaseCacheManager[int]):
            cache_name = "int"

            class IntValueModel(BaseModel):
                pass

            value_validator_model = IntValueModel

        int_manager = IntCacheManager(identifier="int_test")
        assert int_manager.identifier == "int_test"
        assert int_manager._BaseCacheManager__gen_cache_key() == "int:int_test"

        # Test with dict type
        class DictCacheManager(BaseCacheManager[dict[str, Any]]):
            cache_name = "dict"

            class DictValueModel(BaseModel):
                pass

            value_validator_model = DictValueModel

        dict_manager = DictCacheManager(identifier="dict_test")
        assert dict_manager.identifier == "dict_test"
        assert dict_manager._BaseCacheManager__gen_cache_key() == "dict:dict_test"
