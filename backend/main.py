import asyncio
import logging
import math
import os
import re
import time
from datetime import datetime, timezone
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, WebSocket, WebSocketDisconnect

# Load .env from the backend directory so OPENAI_API_KEY is always available
load_dotenv(Path(__file__).parent / ".env")
from fastapi.middleware.cors import CORSMiddleware

from collector import collect_pods, collect_services
from llm import get_insight, parse_insight_sections
from models import GraphNode, GraphResponse, InsightResponse
from rules import analyze, compute_snapshot, infer_dependencies

logging.basicConfig(level=os.getenv("LOG_LEVEL", "info").upper())
logger = logging.getLogger(__name__)

app = FastAPI(title="AI Pod Observer", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- insight cache (keyed by provider) ---
_insight_cache: dict = {
    "openai": {"ts": 0, "data": None},
    "ollama": {"ts": 0, "data": None},
}
# OpenAI costs money — cache for 5 minutes. Ollama is free — cache for 60s.
OPENAI_CACHE_TTL = int(os.getenv("OPENAI_CACHE_TTL", "300"))
OLLAMA_CACHE_TTL = int(os.getenv("OLLAMA_CACHE_TTL", "60"))

# --- pod data cache — shared across /pods, /graph, /insights to reduce k8s API socket churn ---
_pod_cache: dict = {"ts": 0, "pods": None, "services": None}
POD_CACHE_TTL = 10  # seconds — short enough to stay live, long enough to deduplicate bursts


def _cached_pods():
    """Return pod list from cache if fresh, else re-collect."""
    now = time.time()
    if _pod_cache["pods"] is not None and (now - _pod_cache["ts"]) < POD_CACHE_TTL:
        return _pod_cache["pods"], _pod_cache["services"]
    pods = collect_pods()
    services = collect_services()
    _pod_cache.update({"ts": now, "pods": pods, "services": services})
    return pods, services

_CMD_LABEL_RE  = re.compile(r'CMD:\s*(kubectl\s+\S[^\n]*)', re.IGNORECASE)
_KUBECTL_RE    = re.compile(r'(?:^|[\s`"\'])(?P<cmd>kubectl\s+(?:logs?|describe|get|exec|top|delete)\s+\S[^\n`"\']*)', re.MULTILINE | re.IGNORECASE)
_BACKTICK_RE   = re.compile(r'`(kubectl\s+[^`\n]+)`')


def _split_insight(raw: str) -> tuple[str, str]:
    """Extract kubectl command from LLM output, return (clean_text, cmd)."""
    # Priority 1: explicit CMD: label
    m = _CMD_LABEL_RE.search(raw)
    if m:
        cmd = m.group(1).strip()
        clean = _CMD_LABEL_RE.sub('', raw).strip()
        return clean, cmd
    # Priority 2: backtick-wrapped kubectl command
    m = _BACKTICK_RE.search(raw)
    if m:
        return raw, m.group(1).strip()
    # Priority 3: bare kubectl command anywhere in text
    m = _KUBECTL_RE.search(raw)
    if m:
        return raw, m.group('cmd').strip()
    return raw, ""


@app.on_event("startup")
def _startup():
    logger.info("AI Pod Observer backend running — endpoints: /health /pods /anomalies /graph /insights /live")


@app.get("/health")
def health():
    return {"status": "ok", "version": "1.0.0"}


@app.get("/config")
def config_endpoint():
    """Return available AI providers so the frontend can build the toggle."""
    from llm import OPENAI_API_KEY
    has_openai = bool(OPENAI_API_KEY)
    return {
        "openai_available": has_openai,
        "ollama_available": True,
        "default_provider": "openai" if has_openai else "ollama",
    }


@app.get("/pods")
def pods_endpoint():
    """Return all pods with live metrics and cluster snapshot."""
    pod_list, _ = _cached_pods()
    snapshot = compute_snapshot(pod_list)
    return {"pods": [p.model_dump() for p in pod_list], "snapshot": snapshot.model_dump()}


@app.get("/anomalies")
def anomalies_endpoint():
    """Return anomaly events detected by the rule engine."""
    pod_list, _ = _cached_pods()
    anomalies = analyze(pod_list)
    return {"anomalies": [a.model_dump() for a in anomalies], "count": len(anomalies)}


@app.get("/graph")
def graph_endpoint():
    """Return dependency graph nodes and edges."""
    pod_list, services = _cached_pods()
    edges = infer_dependencies(pod_list, services or [])

    total = len(pod_list)
    nodes = []
    for i, pod in enumerate(pod_list):
        angle = (i / max(total, 1)) * 2 * math.pi
        x = 300 + 200 * math.cos(angle)
        y = 200 + 150 * math.sin(angle)
        nodes.append(GraphNode(
            id=pod.name,
            data={
                "label": pod.name,
                "namespace": pod.namespace,
                "status": pod.status,
                "cpu_percent": pod.cpu_percent,
                "memory_percent": pod.memory_percent,
                "restarts": pod.restarts,
                "phase": pod.phase,
                "age_minutes": pod.age_minutes,
            },
            position={"x": round(x, 1), "y": round(y, 1)},
        ))

    response = GraphResponse(nodes=nodes, edges=edges)
    return response.model_dump()


@app.get("/insights")
def insights_endpoint(provider: str = ""):
    """Return LLM insight + anomalies + snapshot. Cached per provider for INSIGHT_CACHE_TTL seconds."""
    from llm import OPENAI_API_KEY
    use_provider = provider if provider in ("openai", "ollama") else (
        "openai" if OPENAI_API_KEY else "ollama"
    )

    cache = _insight_cache[use_provider]
    now = time.time()
    ttl = OPENAI_CACHE_TTL if use_provider == "openai" else OLLAMA_CACHE_TTL
    if cache["data"] and (now - cache["ts"]) < ttl:
        return cache["data"]

    pod_list, _ = _cached_pods()
    anomalies  = analyze(pod_list)
    snapshot   = compute_snapshot(pod_list)
    raw_text = get_insight(pod_list, anomalies, snapshot, requested_provider=use_provider)
    sections = parse_insight_sections(raw_text)

    # Extract kubectl command: prefer parsed action, fall back to regex extraction
    action = sections["action"]
    if not action:
        _, action = _split_insight(raw_text)

    result = InsightResponse(
        insight=sections["root_cause"] or raw_text,
        blast_radius=sections["blast_radius"],
        action=action,
        kubectl_command=action,  # backward compat
        anomalies=anomalies,
        snapshot=snapshot,
        provider=use_provider,
    ).model_dump()

    _insight_cache[use_provider] = {"ts": now, "data": result}
    return result


@app.websocket("/live")
async def live_ws(websocket: WebSocket):
    """Push pod + anomaly updates every 15 seconds."""
    await websocket.accept()
    logger.info("WebSocket /live connected")
    try:
        while True:
            pod_list, _ = _cached_pods()
            anomalies = analyze(pod_list)
            snapshot = compute_snapshot(pod_list)
            payload = {
                "type": "update",
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "pods": [p.model_dump() for p in pod_list],
                "anomalies": [a.model_dump() for a in anomalies],
                "snapshot": snapshot.model_dump(),
            }
            await websocket.send_json(payload)
            await asyncio.sleep(15)
    except WebSocketDisconnect:
        logger.info("WebSocket /live disconnected")
    except Exception as e:
        logger.error("WebSocket error: %s", e)
