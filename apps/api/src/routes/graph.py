"""
graph.py — Dependency graph endpoint.

GET /graph — returns nodes (one per pod) + edges inferred from labels and
             service selectors. The dashboard renders this with React Flow.

Node positions are set to (0, 0) here — the frontend hook (useGraph.js)
recalculates them using a BFS layout algorithm after fetching.
"""
from fastapi import APIRouter

from ..analysis.dependency      import infer_dependencies
from ..collectors.k8s_collector import get_cached_pods
from ..models.graph             import GraphNode, GraphResponse

router = APIRouter(tags=["graph"])


@router.get("/graph", response_model=GraphResponse)
def get_graph():
    """Return pod dependency graph nodes and edges."""
    pods, services = get_cached_pods()
    edges = infer_dependencies(pods, services)

    nodes = [
        GraphNode(
            id=pod.name,
            data={"label": pod.name, "status": pod.status, "namespace": pod.namespace},
            position={"x": 0, "y": 0},  # frontend recalculates
        )
        for pod in pods
    ]
    return GraphResponse(nodes=nodes, edges=edges)
