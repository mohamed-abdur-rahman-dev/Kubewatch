from typing import List

from models import PodMetric, AnomalyEvent, ClusterSnapshot

RULES = {
    "cpu_critical":    lambda p: p.cpu_percent > 80,
    "cpu_high":        lambda p: p.cpu_percent > 60,
    "memory_critical": lambda p: p.memory_percent > 85,
    "memory_high":     lambda p: p.memory_percent > 70,
    "crash_looping":   lambda p: p.restarts >= 5,
    "restarting":      lambda p: p.restarts >= 3,
    "not_running":     lambda p: p.phase != "Running",
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

SKIP_NAMESPACES = {"kube-system", "monitoring", "kube-public", "kube-node-lease"}


def analyze(pods: List[PodMetric]) -> List[AnomalyEvent]:
    """Check all rules against every pod; return anomaly events sorted by urgency."""
    anomalies = []
    for pod in pods:
        triggered = [name for name, fn in RULES.items() if fn(pod)]
        if not triggered:
            continue
        severity = "critical" if any(SEVERITY[r] == "critical" for r in triggered) else "warning"
        anomalies.append(AnomalyEvent(
            pod=pod.name,
            namespace=pod.namespace,
            issues=triggered,
            severity=severity,
            cpu_percent=pod.cpu_percent,
            memory_percent=pod.memory_percent,
            restarts=pod.restarts,
            age_minutes=pod.age_minutes,
        ))
    # Critical first, then by restart count descending, then by CPU descending
    anomalies.sort(key=lambda a: (
        0 if a.severity == "critical" else 1,
        -a.restarts,
        -a.cpu_percent,
    ))
    return anomalies


def infer_dependencies(pods: List[PodMetric], services: list) -> list:
    """Infer pod-to-pod dependency edges. All edges reference actual pod names."""
    from models import DependencyEdge
    from collections import defaultdict

    pod_names: set = {p.name for p in pods}
    seen: set = set()
    result: list = []

    def add_edge(src: str, tgt: str, etype: str) -> None:
        """Only emit edges where both endpoints exist as pod nodes."""
        if src not in pod_names or tgt not in pod_names or src == tgt:
            return
        key = (src, tgt)
        if key not in seen:
            seen.add(key)
            result.append(DependencyEdge(id=f"{src}--{tgt}", source=src, target=tgt, type=etype))

    # Map: app-label-value → list of pod names (used to resolve service references)
    app_to_pods: dict = defaultdict(list)
    for pod in pods:
        app = pod.labels.get("app", "")
        if app:
            app_to_pods[app].append(pod.name)

    # Method 1 — depends-on label resolved via app label of target pods
    # e.g. parking-service pod has depends-on=auth-service; auth-service pod has app=auth-service
    for pod in pods:
        dep_app = pod.labels.get("depends-on", "")
        if dep_app:
            for target_pod in app_to_pods.get(dep_app, []):
                add_edge(pod.name, target_pod, "label_match")

    # Method 2 — Kubernetes service selector: service selects pods A, another pod depends on the service
    # Only needed if depends-on labels weren't set or point to service name not app label
    for svc in services:
        try:
            selector = svc.spec.selector or {}
        except Exception:
            continue
        if not selector:
            continue
        svc_name = svc.metadata.name
        # Pods that this service selects (the "target" side)
        svc_pods = [p.name for p in pods if all(p.labels.get(k) == v for k, v in selector.items())]
        # Pods that explicitly depend on this service by name via depends-on label
        for pod in pods:
            if pod.labels.get("depends-on") == svc_name:
                for target in svc_pods:
                    add_edge(pod.name, target, "label_match")

    # Method 3 — namespace grouping: link orphaned pods in same non-system namespace
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


def compute_snapshot(pods: List[PodMetric]) -> ClusterSnapshot:
    """Count total, healthy, warning, critical pods."""
    total = len(pods)
    healthy = sum(1 for p in pods if p.status == "healthy")
    warning = sum(1 for p in pods if p.status == "warning")
    critical = sum(1 for p in pods if p.status == "critical")
    return ClusterSnapshot(total=total, healthy=healthy, warning=warning, critical=critical)
