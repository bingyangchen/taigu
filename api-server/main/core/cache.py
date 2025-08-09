from typing import Generic, TypeVar

from django.core.cache import cache
from pydantic import BaseModel

T = TypeVar("T")


class BaseCacheManager(Generic[T]):
    cache_name: str
    value_validator_model: type[BaseModel]

    def __init__(self, identifier: str) -> None:
        self.identifier = identifier

    def __gen_cache_key(self) -> str:
        return f"{self.cache_name}:{self.identifier}"

    def get(self) -> T | None:
        return cache.get(self.__gen_cache_key())

    def set(self, value: T, timeout: int) -> None:
        self.value_validator_model.model_validate(value)
        cache.set(self.__gen_cache_key(), value, timeout)
