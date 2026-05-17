"""
test_rules.py — Unit tests for the threshold rule engine.

All tests use PodMetric objects directly — no k8s cluster or Ollama needed.
This is possible because rules.py has zero imports from the k8s client
(infer_dependencies was extracted to dependency.py for exactly this reason).
"""
import pytest

from src.analysis.rules import RULES, SEVERITY, analyze, compute_snapshot
from src.models.pod     import ClusterSnapshot, PodMetric


def _pod(**kwargs) -> PodMetric:
    """Build a PodMetric with sensible defaults so each test only sets relevant fields."""
    defaults = dict(
        name="test-pod", namespace="campus", phase="Running",
        cpu_millicores=0, cpu_percent=0.0,
        memory_mb=0.0, memory_percent=0.0,
        restarts=0, age_minutes=10,
        labels={}, status="healthy",
    )
    defaults.update(kwargs)
    return PodMetric(**defaults)


class TestRules:
    def test_cpu_critical_fires_above_80(self):
        pod = _pod(cpu_percent=85.0)
        assert RULES["cpu_critical"](pod) is True

    def test_cpu_critical_does_not_fire_at_80(self):
        pod = _pod(cpu_percent=80.0)
        assert RULES["cpu_critical"](pod) is False

    def test_memory_critical_fires_above_85(self):
        pod = _pod(memory_percent=90.0)
        assert RULES["memory_critical"](pod) is True

    def test_crash_looping_fires_at_5_restarts(self):
        pod = _pod(restarts=5)
        assert RULES["crash_looping"](pod) is True

    def test_oom_risk_requires_both_conditions(self):
        # Only high memory — no restarts
        assert RULES["oom_risk"](_pod(memory_percent=82.0, restarts=1)) is False
        # Both conditions met
        assert RULES["oom_risk"](_pod(memory_percent=82.0, restarts=2)) is True

    def test_not_running_fires_for_pending_phase(self):
        pod = _pod(phase="Pending")
        assert RULES["not_running"](pod) is True


class TestAnalyze:
    def test_healthy_pod_produces_no_anomaly(self):
        pods = [_pod(cpu_percent=10.0, memory_percent=30.0)]
        assert analyze(pods) == []

    def test_critical_pod_produces_critical_anomaly(self):
        pods = [_pod(name="sick-pod", cpu_percent=90.0, restarts=6)]
        result = analyze(pods)
        assert len(result) == 1
        assert result[0].severity == "critical"
        assert "cpu_critical" in result[0].issues
        assert "crash_looping" in result[0].issues

    def test_anomalies_sorted_critical_first(self):
        pods = [
            _pod(name="warn-pod",     cpu_percent=65.0),
            _pod(name="critical-pod", cpu_percent=90.0),
        ]
        result = analyze(pods)
        assert result[0].pod == "critical-pod"


class TestComputeSnapshot:
    def test_counts_match_pod_statuses(self):
        pods = [
            _pod(name="a", status="healthy"),
            _pod(name="b", status="warning"),
            _pod(name="c", status="critical"),
            _pod(name="d", status="critical"),
        ]
        snap = compute_snapshot(pods)
        assert snap == ClusterSnapshot(total=4, healthy=1, warning=1, critical=2)
