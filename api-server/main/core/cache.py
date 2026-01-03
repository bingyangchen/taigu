from typing import TypeVar, get_args

import redis
from django.core.cache import cache
from pydantic import BaseModel
from redis.backoff import ExponentialBackoff
from redis.retry import Retry

from main.env import env

T = TypeVar("T", bound=BaseModel)


redis_connection_pool = redis.ConnectionPool(
    host=env.REDIS_HOST,
    port=env.REDIS_PORT,
    decode_responses=True,
    max_connections=1000,
    socket_connect_timeout=10,  # TCP connection
    socket_timeout=10,  # Socket I/O
)
redis_retry_policy = Retry(backoff=ExponentialBackoff(), retries=5)


def get_redis_connection() -> redis.Redis:
    return redis.Redis(retry=redis_retry_policy).from_pool(redis_connection_pool)


class BaseCacheManager[T: BaseModel]:
    _value_validator_model: type[BaseModel]

    def __init_subclass__(cls, **kwargs) -> None:  # noqa: ANN003
        super().__init_subclass__(**kwargs)
        orig_bases = getattr(cls, "__orig_bases__", ())
        for base in orig_bases:
            args = get_args(base)
            if args:
                cls._value_validator_model = args[0]
                break
        else:
            raise TypeError(f"Could not extract type argument from {cls}")

    @classmethod
    def __gen_cache_key(cls, identifier: str) -> str:
        return f"{cls.__name__}:{identifier}"

    @classmethod
    def get(cls, identifier: str) -> T | None:
        return cache.get(cls.__gen_cache_key(identifier))

    @classmethod
    def set(cls, identifier: str, value: T, timeout: int) -> None:
        cls._value_validator_model.model_validate(value)
        cache.set(cls.__gen_cache_key(identifier), value, timeout)

    @classmethod
    def delete(cls, identifier: str) -> None:
        cache.delete(cls.__gen_cache_key(identifier))
