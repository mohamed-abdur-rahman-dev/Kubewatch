"""
insight_cache.py — Simple TTL cache for LLM responses.

LLM inference is expensive (5–90s). This cache deduplicates burst requests
that arrive within the TTL window — which happens because the dashboard's
three polling hooks (pods, graph, insights) fire at roughly the same time.

Not thread-safe beyond CPython's GIL, but that's fine for the single-process
Uvicorn deployment used in this demo.
"""
import time
from typing import Any, Optional


class InsightCache:
    """Single-slot TTL cache storing the last generated insight."""

    def __init__(self, ttl_seconds: int = 20):
        self._ttl   = ttl_seconds
        self._ts    = 0.0
        self._value: Optional[Any] = None

    def get(self) -> Optional[Any]:
        """Return cached value if still within TTL, else None."""
        if self._value is not None and (time.time() - self._ts) < self._ttl:
            return self._value
        return None

    def set(self, value: Any) -> None:
        """Store *value* and reset the TTL clock."""
        self._value = value
        self._ts    = time.time()

    def invalidate(self) -> None:
        """Force the next get() to miss."""
        self._ts = 0.0
