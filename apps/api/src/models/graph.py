"""
graph.py — Graph node, edge, and response models.

Moved from: backend/models.py (split by domain).
DependencyEdge was called DependencyEdge in the original models.py.
The name is kept for API backward compatibility.
"""
from pydantic import BaseModel
from typing import Dict, List


class DependencyEdge(BaseModel):
    """A directed edge between two pods in the dependency graph."""
    id:     str   # f"{source}--{target}"
    source: str   # pod name
    target: str   # pod name
    type:   str   # "label_match" | "namespace_group" | "time_correlation"


class GraphNode(BaseModel):
    """A React Flow node descriptor sent to the frontend."""
    id:       str
    data:     Dict   # label, namespace, status, cpu_percent, memory_percent, restarts, phase, age_minutes
    position: Dict   # {"x": float, "y": float} — initial position, overridden by useGraph layout


class GraphResponse(BaseModel):
    """Full /graph response."""
    nodes: List[GraphNode]
    edges: List[DependencyEdge]
