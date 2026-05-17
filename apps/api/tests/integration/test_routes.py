"""
test_routes.py — Integration tests for the FastAPI routes.

These tests use TestClient (sync) and patch get_cached_pods so they don't
need a real Kubernetes cluster. They verify the HTTP contract (status codes,
response shapes) rather than business logic (which unit tests cover).
"""
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from src.main       import app
from src.models.pod import ClusterSnapshot, PodMetric

client = TestClient(app)

# ---------------------------------------------------------------------------
# Shared fixtures
# ---------------------------------------------------------------------------

def _make_pods():
    return [
        PodMetric(
            name="auth-service-abc", namespace="campus", phase="Running",
            cpu_millicores=300, cpu_percent=30.0,
            memory_mb=100.0, memory_percent=20.0,
            restarts=0, age_minutes=120,
            labels={"app": "auth-service"}, status="healthy",
        ),
        PodMetric(
            name="parking-service-xyz", namespace="campus", phase="Running",
            cpu_millicores=850, cpu_percent=85.0,
            memory_mb=220.0, memory_percent=88.0,
            restarts=4, age_minutes=90,
            labels={"app": "parking", "depends-on": "auth-service"}, status="critical",
        ),
    ]


# ---------------------------------------------------------------------------
# /health
# ---------------------------------------------------------------------------

class TestHealth:
    def test_returns_200(self):
        r = client.get("/health")
        assert r.status_code == 200

    def test_returns_ok_status(self):
        r = client.get("/health")
        assert r.json()["status"] == "ok"


# ---------------------------------------------------------------------------
# /pods
# ---------------------------------------------------------------------------

class TestPods:
    def test_returns_200_with_pods_list(self):
        with patch("src.routes.pods.get_cached_pods", return_value=(_make_pods(), [])):
            r = client.get("/pods")
        assert r.status_code == 200
        body = r.json()
        assert "pods" in body and "snapshot" in body
        assert len(body["pods"]) == 2

    def test_returns_empty_list_when_cluster_unavailable(self):
        with patch("src.routes.pods.get_cached_pods", return_value=([], [])):
            r = client.get("/pods")
        assert r.status_code == 200
        assert r.json()["pods"] == []


# ---------------------------------------------------------------------------
# /anomalies
# ---------------------------------------------------------------------------

class TestAnomalies:
    def test_returns_critical_anomaly_for_stressed_pod(self):
        with patch("src.routes.anomalies.get_cached_pods", return_value=(_make_pods(), [])):
            r = client.get("/anomalies")
        assert r.status_code == 200
        body = r.json()
        assert body["count"] >= 1
        severities = {a["severity"] for a in body["anomalies"]}
        assert "critical" in severities


# ---------------------------------------------------------------------------
# /graph
# ---------------------------------------------------------------------------

class TestGraph:
    def test_returns_nodes_and_edges(self):
        with patch("src.routes.graph.get_cached_pods", return_value=(_make_pods(), [])):
            r = client.get("/graph")
        assert r.status_code == 200
        body = r.json()
        assert "nodes" in body and "edges" in body
        assert len(body["nodes"]) == 2
