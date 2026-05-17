"""
ai_client.py — HTTP client for the ai-service (apps/ai-service).

The API service never talks to Ollama directly. It delegates inference to the
ai-service so LLM logic (model selection, prompt building, caching) stays in
one deployable unit that can be scaled independently.

If the ai-service is down, generate() returns a safe fallback dict so the
dashboard still renders rather than showing an error state.
"""
import logging
from dataclasses import dataclass, field
from typing import Dict, List

import httpx

from ..config           import config
from ..models.anomaly   import AnomalyEvent
from ..models.pod       import ClusterSnapshot, PodMetric

logger = logging.getLogger(__name__)

_AI_GENERATE_PATH = "/generate"
_TIMEOUT          = 120  # seconds — generous for llama3.2:1b cold-start

_FALLBACK_SECTIONS: Dict[str, str] = {
    "root_cause": "", "blast_radius": "", "action": "", "raw": "",
}


@dataclass
class AIResult:
    """Normalised result from the ai-service POST /generate."""
    insight:      str
    blast_radius: str = ""
    action:       str = ""
    provider:     str = "ollama"
    sections:     Dict = field(default_factory=dict)


class AIClient:
    """Thin async wrapper around the ai-service HTTP API."""

    async def generate(
        self,
        pods:      List[PodMetric],
        anomalies: List[AnomalyEvent],
        snapshot:  ClusterSnapshot,
    ) -> AIResult:
        """Call POST /generate on the ai-service and return a structured result."""
        payload = {
            "pods":      [p.model_dump() for p in pods],
            "anomalies": [a.model_dump() for a in anomalies],
            "snapshot":  snapshot.model_dump(),
        }
        url = f"{config.ai_service_url}{_AI_GENERATE_PATH}"
        try:
            async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
                response = await client.post(url, json=payload)
                response.raise_for_status()
                body     = response.json()
                sections = body.get("sections", _FALLBACK_SECTIONS)
                return AIResult(
                    insight=body.get("insight", "AI insight unavailable."),
                    blast_radius=sections.get("blast_radius", ""),
                    action=sections.get("action", ""),
                    provider=body.get("provider", "ollama"),
                    sections=sections,
                )
        except httpx.ConnectError:
            logger.warning("ai-service unreachable at %s — returning fallback", url)
            msg = (
                "AI insight unavailable — ai-service not running. "
                "Start with: uvicorn src.main:app --port 8001"
            )
            return AIResult(insight=msg)
        except httpx.TimeoutException:
            logger.warning("ai-service timed out after %ds", _TIMEOUT)
            return AIResult(
                insight="AI insight timed out. The LLM is still loading — try again in 30 seconds."
            )
        except Exception as exc:
            logger.error("ai-service error: %s", exc)
            return AIResult(insight="AI insight temporarily unavailable.")


# Singleton — import this instance, never instantiate a new AIClient.
ai_client = AIClient()
