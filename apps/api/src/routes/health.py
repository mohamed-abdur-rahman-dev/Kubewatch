"""
health.py — Health and config endpoints.

GET /health — liveness probe used by Docker Compose and k8s readiness checks.
GET /config  — exposes non-secret runtime settings so the dashboard can show
               polling intervals without hardcoding them.
"""
from fastapi import APIRouter

from ..config import config

router = APIRouter(tags=["health"])


@router.get("/health")
def health_check():
    """Liveness probe — always returns 200 if the process is alive."""
    return {"status": "ok", "version": "1.0.0"}


@router.get("/config")
def get_config():
    """Return safe (non-secret) runtime config for the frontend."""
    return {
        "collect_interval":  config.collect_interval,
        "insight_cache_ttl": config.insight_cache_ttl,
        "pod_cache_ttl":     config.pod_cache_ttl,
    }
