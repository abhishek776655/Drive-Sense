from __future__ import annotations

from typing import Any

import redis.asyncio as redis


def create_redis_client(redis_url: str) -> redis.Redis[Any]:
    return redis.from_url(redis_url, encoding=None, decode_responses=False)

