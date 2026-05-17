"""
anomaly.py — AnomalyEvent model.

Moved from: backend/models.py (split by domain).
AnomalyEvent is produced by the rule engine (analysis/rules.py)
and consumed by the insights and anomalies routes.
"""
from pydantic import BaseModel
from typing import List


class AnomalyEvent(BaseModel):
    """A pod that triggered one or more threshold rules."""
    pod:            str
    namespace:      str
    issues:         List[str]  # rule keys that fired, e.g. ["cpu_critical", "restarting"]
    severity:       str        # "warning" or "critical" — max severity of triggered rules
    cpu_percent:    float
    memory_percent: float
    restarts:       int
    age_minutes:    int = 0    # used to calculate crash rate (restarts / age_minutes * 60)
