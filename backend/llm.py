import json
import logging
import os
import threading
from typing import List

import requests
import requests.adapters

from models import PodMetric, AnomalyEvent, ClusterSnapshot

logger = logging.getLogger(__name__)

OLLAMA_HOST    = os.getenv("OLLAMA_HOST", "http://localhost:11434")
OLLAMA_MODEL   = os.getenv("OLLAMA_MODEL", "llama3.2:1b")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
OPENAI_MODEL   = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
TIMEOUT        = int(os.getenv("OLLAMA_TIMEOUT", "90"))

# One connection reused across all Ollama calls — reduces socket churn on Windows
_ollama_session = requests.Session()
_ollama_session.mount("http://", requests.adapters.HTTPAdapter(
    pool_connections=1, pool_maxsize=1, max_retries=0,
))

# Mutex: only ONE Ollama inference at a time — prevents thread/socket pile-up
_ollama_lock = threading.Lock()

# ── OpenAI prompt: structured, rich, allows longer reasoning ──────────────────
OPENAI_PROMPT = """You are a senior SRE. Your Kubernetes cluster is alerting.
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

# ── Local prompt: ultra-short, structured — tuned for llama3.2:1b ────────────
LOCAL_PROMPT_TEMPLATE = """\
Cluster: {total} pods | {critical} critical | {warning} warning

Issues:
{issues}

Reply with exactly 3 lines, no other text:
ROOT CAUSE: [pod] has [problem]
BLAST RADIUS: [affected services or 'none']
CMD: kubectl [command] -n [namespace]
"""


def build_local_prompt(
    pods: List[PodMetric],
    anomalies: List[AnomalyEvent],
    snapshot: ClusterSnapshot,
) -> str:
    """Build a short, structured prompt for small local models (llama3.2:1b)."""
    if anomalies:
        lines = [
            f"- {a.pod}: {a.severity}, {a.cpu_percent:.0f}% CPU, "
            f"{a.memory_percent:.0f}% mem, {a.restarts} restarts"
            for a in anomalies[:2]
        ]
        issues = "\n".join(lines)
    else:
        top = sorted(pods, key=lambda p: p.cpu_percent, reverse=True)[:1]
        name = top[0].name if top else "unknown"
        cpu  = top[0].cpu_percent if top else 0
        issues = f"- {name}: {cpu:.0f}% CPU (highest, all pods healthy)"
    return LOCAL_PROMPT_TEMPLATE.format(
        total=snapshot.total,
        critical=snapshot.critical,
        warning=snapshot.warning,
        issues=issues,
    )


def _build_prompt(
    pods: List[PodMetric],
    anomalies: List[AnomalyEvent],
    snapshot: ClusterSnapshot,
    template: str,
) -> str:
    """Build a text prompt for OpenAI (completion-style)."""
    pods_summary = sorted(pods, key=lambda p: p.cpu_percent, reverse=True)[:3]
    pods_json = json.dumps(
        [{"pod": p.name, "cpu": f"{p.cpu_percent:.0f}%",
          "mem": f"{p.memory_percent:.0f}%", "r": p.restarts} for p in pods_summary],
    )
    anomalies_json = (
        json.dumps(
            [{"pod": a.pod, "sev": a.severity,
              "cpu": f"{a.cpu_percent:.0f}%", "mem": f"{a.memory_percent:.0f}%",
              "r": a.restarts, "issues": a.issues[:2]}
             for a in anomalies],
        ) if anomalies else "[]"
    )
    return template.format(
        total=snapshot.total,
        healthy=snapshot.healthy,
        warning=snapshot.warning,
        critical=snapshot.critical,
        pods_json=pods_json,
        anomalies_json=anomalies_json,
    )




def _call_openai(prompt: str) -> str:
    """Call OpenAI API for high-quality insight."""
    if not OPENAI_API_KEY:
        return "OpenAI API key not configured. Add OPENAI_API_KEY to backend/.env or switch to Local AI."
    try:
        response = requests.post(
            "https://api.openai.com/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {OPENAI_API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "model": OPENAI_MODEL,
                "messages": [{"role": "user", "content": prompt}],
                "max_tokens": 220,
                "temperature": 0.2,
            },
            timeout=TIMEOUT,
        )
        if response.status_code == 429:
            logger.warning("OpenAI quota exceeded — user should switch to Local AI")
            return "OpenAI quota exceeded. Switch to Local AI using the provider toggle to continue analysis."
        response.raise_for_status()
        return response.json()["choices"][0]["message"]["content"].strip()
    except requests.exceptions.ConnectionError:
        logger.warning("OpenAI unreachable — switch to Local AI or check network")
        return "OpenAI is unreachable. Switch to Local AI using the toggle above to continue."
    except requests.exceptions.Timeout:
        logger.warning("OpenAI timed out after %ds", TIMEOUT)
        return "OpenAI response timed out. Switch to Local AI for instant local inference."
    except Exception as e:
        logger.error("OpenAI error: %s", e)
        return "OpenAI encountered an error. Switch to Local AI using the toggle above."


def _call_ollama(prompt: str) -> str:
    """Call Ollama generate API with a single prompt string. Serialised via mutex."""
    timeout = 90 if "1b" in OLLAMA_MODEL.lower() else 30
    acquired = _ollama_lock.acquire(blocking=True, timeout=5)
    if not acquired:
        logger.warning("Ollama already running — returning cached placeholder")
        return "AI analysis in progress — results will appear when complete."
    try:
        response = _ollama_session.post(
            f"{OLLAMA_HOST}/api/generate",
            json={
                "model":      OLLAMA_MODEL,
                "prompt":     prompt,
                "stream":     False,
                "keep_alive": -1,
                "options": {
                    "temperature": 0.1,
                    "num_predict": 80,
                    "num_ctx":     512,
                    "num_batch":   32,
                },
            },
            timeout=timeout,
        )
        if response.status_code == 500:
            body = response.text[:300]
            if "model" in body.lower() and ("not found" in body.lower() or "pull" in body.lower()):
                logger.error("Ollama model '%s' not found — run: ollama pull %s", OLLAMA_MODEL, OLLAMA_MODEL)
                return f"Local AI model not found. Run: ollama pull {OLLAMA_MODEL}"
            logger.error("Ollama 500 error: %s", body)
            return f"Local AI returned an error. Try: ollama pull {OLLAMA_MODEL}"
        response.raise_for_status()
        return response.json().get("response", "").strip()
    except requests.exceptions.ConnectionError:
        logger.warning("Ollama not reachable at %s", OLLAMA_HOST)
        return "Local AI unavailable — Ollama not running. Start with: ollama serve"
    except requests.exceptions.Timeout:
        logger.warning("Ollama timed out after %ds", timeout)
        return "Local AI timed out — model may still be loading. Try again in 30 seconds."
    except Exception as e:
        logger.error("Ollama error: %s", e)
        return "Local AI temporarily unavailable."
    finally:
        _ollama_lock.release()


def parse_insight_sections(raw: str) -> dict:
    """Parse raw LLM output into structured sections. Handles imperfect 1B model output."""
    result = {"root_cause": "", "blast_radius": "", "action": "", "raw": raw}

    if not raw or raw.startswith(("ERROR", "TIMEOUT", "Local AI", "OpenAI", "AI analysis")):
        result["root_cause"] = raw
        return result

    for line in raw.strip().splitlines():
        line = line.strip()
        upper = line.upper()
        if upper.startswith("ROOT CAUSE:"):
            result["root_cause"] = line.split(":", 1)[-1].strip()
        elif upper.startswith("BLAST RADIUS:"):
            result["blast_radius"] = line.split(":", 1)[-1].strip()
        elif upper.startswith(("CMD:", "ACTION:")):
            result["action"] = line.split(":", 1)[-1].strip()

    if not result["root_cause"]:
        result["root_cause"] = raw[:200]

    return result


def get_insight(
    pods: List[PodMetric],
    anomalies: List[AnomalyEvent],
    snapshot: ClusterSnapshot,
    requested_provider: str = "",
) -> str:
    """Return LLM insight. Provider can be forced via requested_provider ('openai'|'ollama')."""
    use_openai = requested_provider == "openai" or (not requested_provider and bool(OPENAI_API_KEY))
    if use_openai:
        logger.info("Using OpenAI (%s) for insight", OPENAI_MODEL)
        prompt = _build_prompt(pods, anomalies, snapshot, OPENAI_PROMPT)
        return _call_openai(prompt)
    logger.info("Using Ollama (%s) for insight", OLLAMA_MODEL)
    prompt = build_local_prompt(pods, anomalies, snapshot)
    return _call_ollama(prompt)
