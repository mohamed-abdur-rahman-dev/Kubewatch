"""
cloud_prompt.py — Richer prompt for cloud models (GPT-4o-mini, etc.).

Template and builder extracted verbatim from backend/llm.py OPENAI_PROMPT
and _build_prompt(). Cloud models have larger context windows so we include
more pod detail and allow up to 220 output tokens.
"""
import json
from typing import Any, Dict, List


CLOUD_TEMPLATE = """You are a senior SRE. Your Kubernetes cluster is alerting.
Respond with EXACTLY this three-line format — no preamble, no markdown, no extra text:

ROOT CAUSE: [exact pod name] is [specific problem] — [N] restarts, [CPU]% CPU, [MEM]% memory
BLAST RADIUS: [exact names of services that will fail and how]
CMD: kubectl [logs|describe|top] [exact pod name] -n [namespace]

CLUSTER:
Total: {total} | Healthy: {healthy} | Warning: {warning} | Critical: {critical}

ANOMALIES:
{anomalies_json}

TOP PODS BY CPU:
{pods_json}

If cluster is healthy:
ROOT CAUSE: All {total} pods healthy — no anomalies detected.
BLAST RADIUS: No services at risk of cascading failure.
CMD: kubectl get pods -n campus -o wide
"""


def build_cloud_prompt(
    pods:      List[Dict[str, Any]],
    anomalies: List[Dict[str, Any]],
    snapshot:  Dict[str, Any],
) -> str:
    """Build a structured prompt for cloud models with full cluster context."""
    pods_summary = sorted(pods, key=lambda p: p.get("cpu_percent", 0), reverse=True)[:3]
    pods_json = json.dumps(
        [{"pod": p["name"], "cpu": f"{p.get('cpu_percent', 0):.0f}%",
          "mem": f"{p.get('memory_percent', 0):.0f}%", "r": p.get("restarts", 0)}
         for p in pods_summary],
    )
    anomalies_json = (
        json.dumps(
            [{"pod": a["pod"], "sev": a["severity"],
              "cpu": f"{a.get('cpu_percent', 0):.0f}%",
              "mem": f"{a.get('memory_percent', 0):.0f}%",
              "r": a.get("restarts", 0), "issues": a.get("issues", [])[:2]}
             for a in anomalies],
        ) if anomalies else "[]"
    )
    return CLOUD_TEMPLATE.format(
        total=snapshot.get("total", 0),
        healthy=snapshot.get("healthy", 0),
        warning=snapshot.get("warning", 0),
        critical=snapshot.get("critical", 0),
        pods_json=pods_json,
        anomalies_json=anomalies_json,
    )
