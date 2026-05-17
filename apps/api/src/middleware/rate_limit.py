"""
rate_limit.py — Simple in-memory per-IP rate limiter.

Uses a sliding-window counter stored in a plain dict — no Redis needed for
the demo. Counter resets every WINDOW_SECONDS. Exceeding MAX_REQUESTS returns
HTTP 429 without blocking the event loop.

Limits are intentionally generous (120 req/min) so the dashboard's 15-second
polling never triggers them under normal use.
"""
import time
from collections import defaultdict

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

WINDOW_SECONDS = 60
MAX_REQUESTS   = 120

# ip → [request_count, window_start_epoch]
_counters: dict = defaultdict(lambda: [0, time.time()])


def add_rate_limit(app: FastAPI) -> None:
    """Register a rate-limit middleware on *app*."""

    @app.middleware("http")
    async def _rate_limit(request: Request, call_next):
        ip  = request.client.host if request.client else "unknown"
        now = time.time()
        count, window_start = _counters[ip]

        if now - window_start > WINDOW_SECONDS:
            _counters[ip] = [1, now]
        else:
            _counters[ip][0] += 1
            if _counters[ip][0] > MAX_REQUESTS:
                return JSONResponse(
                    {"error": "rate_limit_exceeded", "retry_after": WINDOW_SECONDS},
                    status_code=429,
                )
        return await call_next(request)
