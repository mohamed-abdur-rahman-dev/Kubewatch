from pydantic import BaseModel
from typing import List, Dict


class PodMetric(BaseModel):
    name: str
    namespace: str
    phase: str
    cpu_millicores: int
    cpu_percent: float
    memory_mb: float
    memory_percent: float
    restarts: int
    age_minutes: int
    labels: Dict[str, str]
    status: str  # healthy / warning / critical


class AnomalyEvent(BaseModel):
    pod: str
    namespace: str
    issues: List[str]
    severity: str  # warning / critical
    cpu_percent: float
    memory_percent: float
    restarts: int
    age_minutes: int = 0


class DependencyEdge(BaseModel):
    id: str
    source: str
    target: str
    type: str  # label_match / namespace_group / time_correlation


class ClusterSnapshot(BaseModel):
    total: int
    healthy: int
    warning: int
    critical: int


class InsightResponse(BaseModel):
    insight: str
    blast_radius: str = ""
    action: str = ""
    kubectl_command: str = ""  # kept for backward compat
    anomalies: List[AnomalyEvent]
    snapshot: ClusterSnapshot
    provider: str = "ollama"  # "ollama" or "openai"


class GraphNode(BaseModel):
    id: str
    data: Dict
    position: Dict


class GraphResponse(BaseModel):
    nodes: List[GraphNode]
    edges: List[DependencyEdge]
