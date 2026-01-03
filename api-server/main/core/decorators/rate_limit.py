import logging
import math
from collections.abc import Callable
from functools import wraps

from django.http import HttpRequest, JsonResponse

from main.account.models import User
from main.core.cache import get_redis_connection

logger = logging.getLogger(__name__)

redis = get_redis_connection()
LUA_SCRIPT = redis.register_script("""
local key = KEYS[1]
local rate = tonumber(ARGV[1])
local capacity = tonumber(ARGV[2])

local t = redis.call("TIME")
local current_timestamp_ms = tonumber(t[1]) * 1000 + math.floor(tonumber(t[2]) / 1000)

local data = redis.call("HMGET", key, "quota", "quota_remainder", "timestamp_ms")
local quota = tonumber(data[1])
local quota_remainder = tonumber(data[2])
local previous_timestamp_ms = tonumber(data[3])

if quota == nil then
    redis.call(
        "HSET", key,
        "quota", capacity - 1,
        "quota_remainder", 0,
        "timestamp_ms", current_timestamp_ms
    )
    return 1
end

local elapsed_ms = current_timestamp_ms - previous_timestamp_ms
local quota_float = quota + quota_remainder + rate * elapsed_ms / 1000
quota_float = math.min(quota_float, capacity)
if quota_float >= 1 then
    quota_float = quota_float - 1
    quota = math.floor(quota_float)
    quota_remainder = quota_float - quota
    redis.call(
        "HSET", key,
        "quota", quota,
        "quota_remainder", quota_remainder,
        "timestamp_ms", current_timestamp_ms
    )
    redis.call("EXPIRE", key, 3600)
    return 1
else
    redis.call(
        "HSET", key,
        "quota", 0,
        "quota_remainder", quota_float,
        "timestamp_ms", current_timestamp_ms
    )
    redis.call("EXPIRE", key, 3600)
    return 0
end
""")


def rate_limit(rate: float, capacity: int | None = None) -> Callable:
    """
    Algorithm: Token Bucket

    - rate: request per second
    - capacity: "burst size" (the maximum number of requests allowed in a moment)
    """

    if capacity is None:
        capacity = math.ceil(rate)

    def decorator(func: Callable) -> Callable:
        def make_key(request: HttpRequest) -> str:
            user_id = (
                request.user.id
                if hasattr(request, "user")
                and isinstance(request.user, User)
                and request.user.is_authenticated
                else "anonymous"
            )
            return f"rate_limit:{request.method}:{request.path}:{user_id}"

        @wraps(func)
        def wrap(request: HttpRequest, *args, **kwargs) -> JsonResponse:  # noqa: ANN002, ANN003
            allowed = LUA_SCRIPT(keys=[make_key(request)], args=[rate, capacity])
            if bool(int(allowed)):
                return func(request, *args, **kwargs)
            else:
                return JsonResponse({"message": "Rate Limit Exceeded"}, status=429)

        return wrap

    return decorator
