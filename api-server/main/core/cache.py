from typing import TypeVar

from django.core.cache import cache
from pydantic import BaseModel

T = TypeVar("T")


class BaseCacheManager[T]:
    cache_name: str
    value_validator_model: type[BaseModel]

    def __gen_cache_key(self, identifier: str) -> str:
        return f"{self.cache_name}:{identifier}"

    def get(self, identifier: str) -> T | None:
        return cache.get(self.__gen_cache_key(identifier))

    def set(self, identifier: str, value: T, timeout: int) -> None:
        self.value_validator_model.model_validate(value)
        cache.set(self.__gen_cache_key(identifier), value, timeout)

    def delete(self, identifier: str) -> None:
        cache.delete(self.__gen_cache_key(identifier))
