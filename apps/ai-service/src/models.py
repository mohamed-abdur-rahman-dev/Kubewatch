"""
models.py — Pydantic models for the ai-service HTTP API.

InsightRequest mirrors the payload the API service sends to POST /generate.
InsightResponse is what we return. These are intentionally separate from the
apps/api models — the ai-service is a standalone deployable unit.
"""
from typing import Any, Dict, List

from pydantic import BaseModel


class PodSummary(BaseModel):
    """Minimal pod fields needed to build an LLM prompt."""
    name:           str
    namespace:      str
    cpu_percent:    float
    memory_percent: float
    restarts:       int
    status:         str


class AnomalySummary(BaseModel):
    """Minimal anomaly fields for the prompt."""
    pod:            str
    severity:       str
    cpu_percent:    float
    memory_percent: float
    restarts:       int
    issues:         List[str]


class SnapshotSummary(BaseModel):
    """Cluster health counts."""
    total:    int
    healthy:  int
    warning:  int
    critical: int


class InsightRequest(BaseModel):
    """Payload from the API service — all the data needed to build a prompt."""
    pods:      List[Dict[str, Any]]  # raw dicts — we parse into PodSummary internally
    anomalies: List[Dict[str, Any]]
    snapshot:  Dict[str, Any]
    provider:  str = ""  # optional override: 'ollama' | 'openai'


class InsightResponse(BaseModel):
    """Response returned to the API service."""
    insight:  str
    provider: str  # which provider actually generated the insight
    sections: Dict[str, str]  # parsed ROOT CAUSE / BLAST RADIUS / CMD sections
