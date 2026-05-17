# collectors package — exposes the cached pod fetcher used by all route handlers.
from .k8s_collector import get_cached_pods, collect_events

__all__ = ["get_cached_pods", "collect_events"]
