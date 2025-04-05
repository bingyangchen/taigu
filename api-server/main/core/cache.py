from typing import Generic, TypeVar

from django.core.cache import cache

T = TypeVar("T")


class BaseCacheManager(Generic[T]):
    def __init__(self, identifier: str):
        self.identifier = identifier

    # NOTE: Don't use double underscore to name this method, as subclasses won't be able
    #       to override it due to name mangling.
    def _gen_cache_key(self) -> str:
        raise NotImplementedError

    def get(self) -> T | None:
        return cache.get(self._gen_cache_key())

    def set(self, value: T, timeout: int) -> None:
        cache.set(self._gen_cache_key(), value, timeout)
