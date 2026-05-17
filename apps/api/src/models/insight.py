"""
insight.py — InsightResponse model.

Moved from: backend/models.py (split by domain).
InsightResponse is what the /insights endpoint returns and what the frontend
reads to populate the AI analysis panel.

blast_radius and action are separate top-level fields (not buried inside insight)
so the frontend can render them independently without string parsing.
"""
from pydantic import BaseModel
from typing import List

from .anomaly import AnomalyEvent
from .pod     import ClusterSnapshot


class InsightResponse(BaseModel):
    """Structured AI insight response returned by /insights."""
    insight:        str              # root cause text (typewriter-animated in frontend)
    blast_radius:   str   = ""      # which services are at risk
    action:         str   = ""      # recommended kubectl command
    kubectl_command:str   = ""      # kept for backward compat with older frontend versions
    anomalies:      List[AnomalyEvent]
    snapshot:       ClusterSnapshot
    provider:       str   = "ollama" # "ollama" or "openai" — which provider actually responded
