"""Rate limiting configuration.

Uses slowapi (built on the `limits` library). Default storage is in-memory
(per-process). For multi-worker deployments, set RATE_LIMIT_STORAGE_URI to
a Redis URL (e.g. "redis://localhost:6379").

The key function uses the direct peer address (REMOTE_ADDR) by default.
Do NOT trust X-Forwarded-For without a verified reverse proxy.
"""

from __future__ import annotations

from slowapi import Limiter
from slowapi.util import get_remote_address

from .config import settings

limiter = Limiter(
    key_func=get_remote_address,
    default_limits=[f"{settings.rate_limit_per_minute}/minute"],
    storage_uri=settings.rate_limit_storage_uri,
)
