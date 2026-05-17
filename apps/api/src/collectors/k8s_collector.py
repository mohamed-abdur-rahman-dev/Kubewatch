"""
k8s_collector.py — Kubernetes API data collection.

Moved from: backend/collector.py
New location: apps/api/src/collectors/k8s_collector.py

Changes from original:
  - Import path updated: `from ..models.pod import PodMetric`
  - `collect_pods` and `collect_services` combined into `get_cached_pods()` —
    routes call a single function instead of two separate ones.
  - Module-level pod cache moved here from main.py so any route can use it
    without importing from the entry point (which causes circular imports).

No logic was changed. Parsing, thresholds, and status computation are identical.
"""
import logging
import time
from datetime import datetime, timezone
from typing import List, Tuple

from kubernetes import client, config
from kubernetes.client.rest import ApiException

from ..models.pod import PodMetric

logger = logging.getLogger(__name__)

CPU_LIMIT_DEFAULT_M  = 1000   # millicores — used when pod has no CPU limit set
MEM_LIMIT_DEFAULT_MB = 512    # MB — used when pod has no memory limit set

# ── Module-level pod cache ─────────────────────────────────────────────────────
# Shared across all route handlers to avoid hammering the k8s API on every request.
# TTL is short (10s) so the dashboard stays live, but long enough to deduplicate
# burst requests from concurrent /pods + /graph + /insights calls.
_pod_cache: dict = {"ts": 0, "pods": None, "services": None}
POD_CACHE_TTL = 10  # seconds


def get_cached_pods() -> Tuple[List[PodMetric], list]:
    """Return (pods, services) from cache if fresh, else re-collect from k8s."""
    now = time.time()
    if _pod_cache["pods"] is not None and (now - _pod_cache["ts"]) < POD_CACHE_TTL:
        return _pod_cache["pods"], _pod_cache["services"]
    pods     = collect_pods()
    services = collect_services()
    _pod_cache.update({"ts": now, "pods": pods, "services": services})
    return pods, services


# ── Internal helpers ───────────────────────────────────────────────────────────

def _parse_cpu(val: str) -> int:
    """Parse Kubernetes CPU string to millicores. '450m' → 450, '2' → 2000."""
    if not val:
        return 0
    if val.endswith("m"):
        return int(val[:-1])
    if val.endswith("n"):
        return int(val[:-1]) // 1_000_000
    return int(float(val) * 1000)


def _parse_mem(val: str) -> float:
    """Parse Kubernetes memory string to MB. '312Mi' → 312, '1Gi' → 1024."""
    if not val:
        return 0.0
    if val.endswith("Ki"):
        return int(val[:-2]) / 1024
    if val.endswith("Mi"):
        return float(val[:-2])
    if val.endswith("Gi"):
        return float(val[:-2]) * 1024
    if val.endswith("k"):
        return int(val[:-1]) / 1000
    return float(val) / (1024 * 1024)


def _compute_status(cpu_pct: float, mem_pct: float, restarts: int) -> str:
    """Classify pod health. Thresholds match the frontend ResourceBar color breakpoints."""
    if cpu_pct > 80 or mem_pct > 85 or restarts >= 3:
        return "critical"
    if cpu_pct > 60 or mem_pct > 70:
        return "warning"
    return "healthy"


def _load_k8s_config() -> None:
    """Try in-cluster config first (for deployed pods), fall back to kubeconfig."""
    try:
        config.load_incluster_config()
    except config.ConfigException:
        config.load_kube_config()


# ── Public collectors ──────────────────────────────────────────────────────────

def collect_pods() -> List[PodMetric]:
    """Collect live pod metrics from Kubernetes cluster."""
    try:
        _load_k8s_config()
    except Exception as e:
        logger.warning("kubeconfig not found: %s", e)
        return []

    core   = client.CoreV1Api()
    custom = client.CustomObjectsApi()

    try:
        pod_items = core.list_pod_for_all_namespaces(watch=False).items
    except Exception as e:
        logger.error("Error listing pods: %s", e)
        return []

    # Fetch metrics with up to 3 retries — metrics-server returns 503 on cold start
    metrics_map: dict = {}
    for attempt in range(3):
        try:
            metrics_raw = custom.list_cluster_custom_object("metrics.k8s.io", "v1beta1", "pods")
            for item in metrics_raw.get("items", []):
                mname      = item["metadata"]["name"]
                mns        = item["metadata"]["namespace"]
                containers = item.get("containers", [])
                total_cpu_m  = sum(_parse_cpu(c.get("usage", {}).get("cpu",    "0m"))  for c in containers)
                total_mem_mb = sum(_parse_mem(c.get("usage", {}).get("memory", "0Mi")) for c in containers)
                metrics_map[(mns, mname)] = (total_cpu_m, total_mem_mb)
            break
        except ApiException as e:
            if e.status == 503 and attempt < 2:
                logger.debug("metrics-server 503, retry %d/2", attempt + 1)
                time.sleep(1)
            else:
                logger.warning("metrics-server unavailable (HTTP %s) — returning 0%% usage", e.status)
                break
        except Exception as e:
            logger.warning("metrics-server unavailable: %s — returning 0%% usage", e)
            break

    now   = datetime.now(timezone.utc)
    pods: List[PodMetric] = []

    for pod in pod_items:
        name      = pod.metadata.name
        namespace = pod.metadata.namespace
        phase     = pod.status.phase or "Unknown"
        labels    = dict(pod.metadata.labels or {})

        restarts = 0
        if pod.status.container_statuses:
            restarts = sum(cs.restart_count for cs in pod.status.container_statuses)

        created     = pod.metadata.creation_timestamp
        age_minutes = int((now - created).total_seconds() // 60) if created else 0

        cpu_limit_m  = CPU_LIMIT_DEFAULT_M
        mem_limit_mb = MEM_LIMIT_DEFAULT_MB
        try:
            limits = pod.spec.containers[0].resources.limits or {}
            if "cpu"    in limits: cpu_limit_m  = _parse_cpu(limits["cpu"])    or CPU_LIMIT_DEFAULT_M
            if "memory" in limits: mem_limit_mb = _parse_mem(limits["memory"]) or MEM_LIMIT_DEFAULT_MB
        except Exception:
            pass

        cpu_m, mem_mb = metrics_map.get((namespace, name), (0, 0.0))
        cpu_pct = round(cpu_m   / cpu_limit_m  * 100, 1) if cpu_limit_m  else 0.0
        mem_pct = round(mem_mb  / mem_limit_mb * 100, 1) if mem_limit_mb else 0.0

        pods.append(PodMetric(
            name=name, namespace=namespace, phase=phase,
            cpu_millicores=cpu_m, cpu_percent=cpu_pct,
            memory_mb=round(mem_mb, 1), memory_percent=mem_pct,
            restarts=restarts, age_minutes=age_minutes,
            labels=labels, status=_compute_status(cpu_pct, mem_pct, restarts),
        ))

    return pods


def collect_services() -> list:
    """Return raw Kubernetes Service objects from all namespaces."""
    try:
        _load_k8s_config()
        return client.CoreV1Api().list_service_for_all_namespaces(watch=False).items
    except Exception as e:
        logger.warning("Could not collect services: %s", e)
        return []


def collect_events() -> list:
    """Return Warning events from the last 10 minutes (max 50)."""
    try:
        _load_k8s_config()
        events = client.CoreV1Api().list_event_for_all_namespaces(watch=False).items
        now    = datetime.now(timezone.utc)
        result = []
        for ev in events:
            if ev.type != "Warning":
                continue
            ts = ev.last_timestamp or ev.event_time
            if ts and (now - ts.replace(tzinfo=timezone.utc)).total_seconds() <= 600:
                result.append(ev)
        return result[-50:]
    except Exception as e:
        logger.warning("Could not collect events: %s", e)
        return []
