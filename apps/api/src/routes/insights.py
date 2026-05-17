"""
insights.py — AI-generated cluster insight endpoint.

GET /insights — collects current pods + anomalies, calls the ai-service for
                an LLM-generated summary, and returns everything the InsightPanel
                needs in one response.

The result is cached for INSIGHT_CACHE_TTL seconds (default 20s) because LLM
inference is slow (~5-30s) and all three dashboard polls (graph, pods, insights)
fire at roughly the same time on load.
"""
import logging
import time

from fastapi import APIRouter

from ..analysis.rules           import analyze, compute_snapshot
from ..clients.ai_client        import ai_client
from ..collectors.k8s_collector import get_cached_pods
from ..config                   import config
from ..models.insight           import InsightResponse

logger = logging.getLogger(__name__)
router = APIRouter(tags=["insights"])

# Simple in-process cache — (timestamp, InsightResponse)
_cache: dict = {"ts": 0.0, "data": None}


@router.get("/insights", response_model=InsightResponse)
async def get_insights():
    """Return AI insight text + anomaly list + cluster snapshot, cached for TTL seconds."""
    now = time.time()
    if _cache["data"] is not None and (now - _cache["ts"]) < config.insight_cache_ttl:
        return _cache["data"]

    pods, _   = get_cached_pods()
    anomalies = analyze(pods)
    snapshot  = compute_snapshot(pods)

    ai_result = await ai_client.generate(pods, anomalies, snapshot)

    result = InsightResponse(
        insight=ai_result.insight,
        blast_radius=ai_result.blast_radius,
        action=ai_result.action,
        provider=ai_result.provider,
        anomalies=anomalies,
        snapshot=snapshot,
    )
    _cache.update({"ts": now, "data": result})
    return result
