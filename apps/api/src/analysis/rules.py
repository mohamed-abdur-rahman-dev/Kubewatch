"""
rules.py — Threshold-based rule engine.

Moved from: backend/rules.py
New location: apps/api/src/analysis/rules.py

Changes from original:
  - Import path: `from ..models import PodMetric, AnomalyEvent, ClusterSnapshot`
  - `infer_dependencies` extracted → dependency.py
    (reason: dependency inference has its own concerns — service selectors,
    namespace grouping, graph edge deduplication — separate from threshold rules)
  - No threshold values or sort logic changed.
"""
from typing import List
from ..models.pod     import PodMetric, ClusterSnapshot
from ..models.anomaly import AnomalyEvent

# ── Rule definitions ───────────────────────────────────────────────────────────
# Each rule is a lambda over a PodMetric. Add new rules here only.
# Corresponding severity must be added to SEVERITY dict too.
RULES = {
    "cpu_critical":    lambda p: p.cpu_percent    > 80,
    "cpu_high":        lambda p: p.cpu_percent    > 60,
    "memory_critical": lambda p: p.memory_percent > 85,
    "memory_high":     lambda p: p.memory_percent > 70,
    "crash_looping":   lambda p: p.restarts       >= 5,
    "restarting":      lambda p: p.restarts       >= 3,
    "not_running":     lambda p: p.phase          != "Running",
    "oom_risk":        lambda p: p.memory_percent > 80 and p.restarts >= 2,
}

SEVERITY = {
    "cpu_critical":    "critical",
    "memory_critical": "critical",
    "crash_looping":   "critical",
    "oom_risk":        "critical",
    "cpu_high":        "warning",
    "memory_high":     "warning",
    "restarting":      "warning",
    "not_running":     "warning",
}


def analyze(pods: List[PodMetric]) -> List[AnomalyEvent]:
    """Check all rules against every pod; return anomaly events sorted by urgency."""
    anomalies = []
    for pod in pods:
        triggered = [name for name, fn in RULES.items() if fn(pod)]
        if not triggered:
            continue
        severity = "critical" if any(SEVERITY[r] == "critical" for r in triggered) else "warning"
        anomalies.append(AnomalyEvent(
            pod=pod.name, namespace=pod.namespace, issues=triggered,
            severity=severity, cpu_percent=pod.cpu_percent,
            memory_percent=pod.memory_percent, restarts=pod.restarts,
            age_minutes=pod.age_minutes,
        ))
    # Critical first, then by restart count desc, then by CPU desc
    anomalies.sort(key=lambda a: (0 if a.severity == "critical" else 1, -a.restarts, -a.cpu_percent))
    return anomalies


def compute_snapshot(pods: List[PodMetric]) -> ClusterSnapshot:
    """Count total, healthy, warning, critical pods for the status bar."""
    return ClusterSnapshot(
        total=len(pods),
        healthy=sum(1 for p in pods if p.status == "healthy"),
        warning=sum(1 for p in pods if p.status == "warning"),
        critical=sum(1 for p in pods if p.status == "critical"),
    )
