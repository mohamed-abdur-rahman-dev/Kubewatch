"""
dependency.py — Dependency edge inference from pod labels and service selectors.

Extracted from: backend/rules.py (infer_dependencies function)
New location: apps/api/src/analysis/dependency.py

Why extracted:
  Rules are pure threshold checks on scalar metrics — they need no k8s service data.
  Dependency inference reads labels, service selectors, and namespace groups — a
  completely different concern. Separating them means:
    1. rules.py has zero imports from the k8s client — it can be unit-tested standalone.
    2. dependency.py can evolve (e.g. add time-correlation) without touching rule logic.

No logic was changed. Three inference methods are identical to the original:
  Method 1 — depends-on label resolved via app label
  Method 2 — Kubernetes service selector mapping
  Method 3 — Namespace grouping for orphaned pods
"""
from collections import defaultdict
from typing import List

from ..models.pod   import PodMetric
from ..models.graph import DependencyEdge

# Namespaces that are infrastructure noise — never add namespace-group edges for these
SKIP_NAMESPACES = {"kube-system", "monitoring", "kube-public", "kube-node-lease"}


def infer_dependencies(pods: List[PodMetric], services: list) -> List[DependencyEdge]:
    """Infer pod-to-pod dependency edges. All edges reference actual pod names."""
    pod_names: set = {p.name for p in pods}
    seen: set      = set()
    result: list   = []

    def add_edge(src: str, tgt: str, etype: str) -> None:
        """Emit an edge only when both endpoints exist as pod nodes and not already seen."""
        if src not in pod_names or tgt not in pod_names or src == tgt:
            return
        key = (src, tgt)
        if key not in seen:
            seen.add(key)
            result.append(DependencyEdge(id=f"{src}--{tgt}", source=src, target=tgt, type=etype))

    # app-label-value → list of pod names
    app_to_pods: dict = defaultdict(list)
    for pod in pods:
        app = pod.labels.get("app", "")
        if app:
            app_to_pods[app].append(pod.name)

    # Method 1 — depends-on label resolved via app label of target pods
    # e.g. parking-service has depends-on=auth-service; auth-service pod has app=auth-service
    for pod in pods:
        dep_app = pod.labels.get("depends-on", "")
        if dep_app:
            for target_pod in app_to_pods.get(dep_app, []):
                add_edge(pod.name, target_pod, "label_match")

    # Method 2 — Kubernetes service selector matching
    # Useful when pods use `depends-on: <service-name>` (not the app label of the target pod)
    for svc in services:
        try:
            selector = svc.spec.selector or {}
        except Exception:
            continue
        if not selector:
            continue
        svc_name = svc.metadata.name
        svc_pods = [p.name for p in pods if all(p.labels.get(k) == v for k, v in selector.items())]
        for pod in pods:
            if pod.labels.get("depends-on") == svc_name:
                for target in svc_pods:
                    add_edge(pod.name, target, "label_match")

    # Method 3 — Namespace grouping for pods with no explicit dependency labels
    # Creates a mesh between orphaned pods in the same non-system namespace
    ns_groups: dict = defaultdict(list)
    for pod in pods:
        if pod.namespace not in SKIP_NAMESPACES:
            ns_groups[pod.namespace].append(pod.name)

    pods_with_edges = {e.source for e in result} | {e.target for e in result}
    for names in ns_groups.values():
        orphans = [n for n in names if n not in pods_with_edges]
        for i, src in enumerate(orphans):
            for tgt in orphans[i + 1:]:
                add_edge(src, tgt, "namespace_group")

    return result
