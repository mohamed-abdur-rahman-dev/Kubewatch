"""
ollama.py — Ollama local inference provider.

Logic extracted verbatim from backend/llm.py _call_ollama().
No logic was changed — only the class wrapper and import paths are new.

Key design decisions preserved from the original:
- threading.Lock prevents concurrent Ollama calls piling up (one queue at a time)
- keep_alive: -1 keeps the model loaded between requests (critical for 1B on 8GB)
- num_ctx: 512 keeps VRAM usage below 512MB for llama3.2:1b
- dynamic timeout: 90s for 1B models, 30s for larger ones
"""
import logging
import threading

import requests
import requests.adapters

from ..config        import config
from .base           import LLMProvider, LLMResponse

logger = logging.getLogger(__name__)

# One connection reused across all Ollama calls — reduces socket churn on Windows
_session = requests.Session()
_session.mount("http://", requests.adapters.HTTPAdapter(
    pool_connections=1, pool_maxsize=1, max_retries=0,
))

# Only ONE Ollama inference at a time — prevents thread/socket pile-up
_lock = threading.Lock()


class OllamaProvider(LLMProvider):
    """Local inference via Ollama /api/generate."""

    @property
    def name(self) -> str:
        return "ollama"

    def generate(self, prompt: str) -> LLMResponse:
        """Send *prompt* to Ollama and return the response text."""
        timeout  = 90 if "1b" in config.ollama_model.lower() else 30
        acquired = _lock.acquire(blocking=True, timeout=5)
        if not acquired:
            logger.warning("Ollama already running — returning in-progress placeholder")
            return LLMResponse(
                text="AI analysis in progress — results will appear when complete.",
                provider=self.name, success=False,
            )
        try:
            response = _session.post(
                f"{config.ollama_host}/api/generate",
                json={
                    "model":      config.ollama_model,
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
                    logger.error("Ollama model '%s' not found", config.ollama_model)
                    return LLMResponse(
                        text=f"Local AI model not found. Run: ollama pull {config.ollama_model}",
                        provider=self.name, success=False,
                    )
                logger.error("Ollama 500: %s", body)
                return LLMResponse(
                    text=f"Local AI returned an error. Try: ollama pull {config.ollama_model}",
                    provider=self.name, success=False,
                )
            response.raise_for_status()
            text = response.json().get("response", "").strip()
            return LLMResponse(text=text, provider=self.name)
        except requests.exceptions.ConnectionError:
            logger.warning("Ollama not reachable at %s", config.ollama_host)
            return LLMResponse(
                text="Local AI unavailable — Ollama not running. Start with: ollama serve",
                provider=self.name, success=False,
            )
        except requests.exceptions.Timeout:
            logger.warning("Ollama timed out after %ds", timeout)
            return LLMResponse(
                text="Local AI timed out — model may still be loading. Try again in 30 seconds.",
                provider=self.name, success=False,
            )
        except Exception as exc:
            logger.error("Ollama error: %s", exc)
            return LLMResponse(
                text="Local AI temporarily unavailable.",
                provider=self.name, success=False,
            )
        finally:
            _lock.release()
