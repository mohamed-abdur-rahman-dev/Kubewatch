"""
logging.py — Structured request/response logging middleware.

Logs method, path, status code, and latency for every request at INFO level.
Errors are logged at ERROR level with the exception message so they're easy
to grep in production logs.
"""
import logging
import time

from fastapi import FastAPI, Request

logger = logging.getLogger("api.access")


def add_logging(app: FastAPI) -> None:
    """Register a request-logging middleware on *app*."""

    @app.middleware("http")
    async def _log_request(request: Request, call_next):
        start = time.perf_counter()
        try:
            response = await call_next(request)
            elapsed_ms = (time.perf_counter() - start) * 1000
            logger.info(
                "%s %s → %d  (%.1fms)",
                request.method,
                request.url.path,
                response.status_code,
                elapsed_ms,
            )
            return response
        except Exception as exc:
            elapsed_ms = (time.perf_counter() - start) * 1000
            logger.error(
                "%s %s → 500  (%.1fms)  %s",
                request.method,
                request.url.path,
                elapsed_ms,
                exc,
            )
            raise
