"""
pods.py — Pod listing and live WebSocket stream.

GET /pods        — snapshot of all pods + cluster summary counts.
WebSocket /live  — pushes pods + anomalies every COLLECT_INTERVAL seconds.
                   Used by the dashboard StatusBar for the blinking LIVE indicator.
"""
import asyncio
import logging

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from ..analysis.rules       import analyze, compute_snapshot
from ..collectors.k8s_collector import get_cached_pods
from ..config               import config

router = APIRouter(tags=["pods"])
logger = logging.getLogger(__name__)


@router.get("/pods")
def list_pods():
    """Return all pods and a cluster health summary."""
    pods, _ = get_cached_pods()
    snapshot = compute_snapshot(pods)
    return {"pods": [p.model_dump() for p in pods], "snapshot": snapshot.model_dump()}


@router.websocket("/live")
async def live_feed(websocket: WebSocket):
    """Stream live pod + anomaly data every COLLECT_INTERVAL seconds."""
    await websocket.accept()
    try:
        while True:
            pods, _   = get_cached_pods()
            anomalies = analyze(pods)
            snapshot  = compute_snapshot(pods)
            await websocket.send_json({
                "pods":      [p.model_dump()       for p in pods],
                "anomalies": [a.model_dump()       for a in anomalies],
                "snapshot":  snapshot.model_dump(),
            })
            await asyncio.sleep(config.collect_interval)
    except WebSocketDisconnect:
        logger.debug("WebSocket /live disconnected")
    except Exception as exc:
        logger.error("WebSocket /live error: %s", exc)
