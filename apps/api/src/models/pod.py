"""
pod.py — PodMetric and ClusterSnapshot data models.

Moved from: backend/models.py
Split reason: models.py was a flat file mixing pod, anomaly, graph, and insight shapes.
Domain-based splitting makes it clear which team owns which model, and prevents
circular imports when graph.py references pod.py but not vice versa.

ClusterSnapshot lives here (not in its own file) because it is a direct aggregate
of pod statuses — a ClusterSnapshot without PodMetric would have no meaning.
"""
from pydantic import BaseModel
from typing import Dict


class PodMetric(BaseModel):
    """Live metrics for a single Kubernetes pod."""
    name:           str
    namespace:      str
    phase:          str           # Running / Pending / Failed / Unknown
    cpu_millicores: int           # raw value from metrics-server
    cpu_percent:    float         # cpu_millicores / cpu_limit * 100
    memory_mb:      float
    memory_percent: float
    restarts:       int
    age_minutes:    int
    labels:         Dict[str, str]
    status:         str           # healthy / warning / critical (computed by collector)


class ClusterSnapshot(BaseModel):
    """Aggregate counts for the status bar and LLM context."""
    total:    int
    healthy:  int
    warning:  int
    critical: int
