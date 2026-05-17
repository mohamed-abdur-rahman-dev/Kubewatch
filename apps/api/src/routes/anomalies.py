"""
anomalies.py — Anomaly detection endpoint.

GET /anomalies — runs the threshold rule engine against current pods and
                 returns only the pods that triggered at least one rule.
                 The dashboard uses this for the anomaly card section.
"""
from fastapi import APIRouter

from ..analysis.rules           import analyze
from ..collectors.k8s_collector import get_cached_pods

router = APIRouter(tags=["anomalies"])


@router.get("/anomalies")
def list_anomalies():
    """Return pods that triggered at least one threshold rule, with severity."""
    pods, _   = get_cached_pods()
    anomalies = analyze(pods)
    return {"anomalies": [a.model_dump() for a in anomalies], "count": len(anomalies)}
