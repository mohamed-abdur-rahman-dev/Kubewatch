"""
test_dependency.py — Unit tests for dependency edge inference.

Uses plain PodMetric objects and minimal mock service objects.
No k8s client, no cluster required.
"""
import pytest
from types import SimpleNamespace

from src.analysis.dependency import SKIP_NAMESPACES, infer_dependencies
from src.models.pod          import PodMetric


def _pod(name, namespace="campus", labels=None) -> PodMetric:
    return PodMetric(
        name=name, namespace=namespace, phase="Running",
        cpu_millicores=0, cpu_percent=0.0,
        memory_mb=0.0, memory_percent=0.0,
        restarts=0, age_minutes=5,
        labels=labels or {}, status="healthy",
    )


def _svc(name, selector: dict):
    """Minimal mock of a Kubernetes Service object."""
    return SimpleNamespace(
        metadata=SimpleNamespace(name=name),
        spec=SimpleNamespace(selector=selector),
    )


class TestLabelMatchMethod:
    def test_depends_on_label_creates_edge(self):
        pods = [
            _pod("parking-pod", labels={"app": "parking", "depends-on": "auth"}),
            _pod("auth-pod",    labels={"app": "auth"}),
        ]
        edges = infer_dependencies(pods, [])
        sources = {e.source for e in edges}
        targets = {e.target for e in edges}
        assert "parking-pod" in sources
        assert "auth-pod"    in targets

    def test_no_depends_on_label_no_label_edge(self):
        pods = [_pod("a"), _pod("b")]
        edges = [e for e in infer_dependencies(pods, []) if e.type == "label_match"]
        assert edges == []


class TestServiceSelectorMethod:
    def test_service_selector_creates_edge(self):
        pods = [
            _pod("client-pod", labels={"depends-on": "auth-svc"}),
            _pod("auth-pod",   labels={"app": "auth"}),
        ]
        services = [_svc("auth-svc", {"app": "auth"})]
        edges = infer_dependencies(pods, services)
        assert any(e.source == "client-pod" and e.target == "auth-pod" for e in edges)


class TestNamespaceGroupMethod:
    def test_orphans_in_same_namespace_get_grouped(self):
        pods = [_pod("x", "team-ns"), _pod("y", "team-ns")]
        edges = infer_dependencies(pods, [])
        ns_edges = [e for e in edges if e.type == "namespace_group"]
        assert len(ns_edges) == 1

    def test_system_namespaces_skipped(self):
        for ns in SKIP_NAMESPACES:
            pods = [_pod("a", ns), _pod("b", ns)]
            edges = infer_dependencies(pods, [])
            assert edges == [], f"Expected no edges for namespace {ns}"

    def test_deduplication_prevents_duplicate_edges(self):
        pods = [_pod("a", "ns"), _pod("b", "ns")]
        edges = infer_dependencies(pods, [])
        keys = [(e.source, e.target) for e in edges]
        assert len(keys) == len(set(keys))
