"""
openai.py — OpenAI cloud inference provider.

Logic extracted verbatim from backend/llm.py _call_openai().
Uses the chat completions endpoint with the cloud prompt template.
Falls back gracefully for every error case so the dashboard keeps rendering.
"""
import logging

import requests

from ..config    import config
from .base       import LLMProvider, LLMResponse

logger = logging.getLogger(__name__)

_COMPLETIONS_URL = "https://api.openai.com/v1/chat/completions"


class OpenAIProvider(LLMProvider):
    """Cloud inference via OpenAI chat completions."""

    @property
    def name(self) -> str:
        return "openai"

    def generate(self, prompt: str) -> LLMResponse:
        """Send *prompt* to OpenAI and return the response text."""
        if not config.openai_api_key:
            return LLMResponse(
                text=(
                    "OpenAI API key not configured. "
                    "Add OPENAI_API_KEY to .env or switch to Local AI."
                ),
                provider=self.name, success=False,
            )
        try:
            response = requests.post(
                _COMPLETIONS_URL,
                headers={
                    "Authorization": f"Bearer {config.openai_api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model":       config.openai_model,
                    "messages":    [{"role": "user", "content": prompt}],
                    "max_tokens":  220,
                    "temperature": 0.2,
                },
                timeout=config.openai_timeout,
            )
            if response.status_code == 429:
                logger.warning("OpenAI quota exceeded")
                return LLMResponse(
                    text="OpenAI quota exceeded. Switch to Local AI to continue analysis.",
                    provider=self.name, success=False,
                )
            response.raise_for_status()
            text = response.json()["choices"][0]["message"]["content"].strip()
            return LLMResponse(text=text, provider=self.name)
        except requests.exceptions.ConnectionError:
            logger.warning("OpenAI unreachable")
            return LLMResponse(
                text="OpenAI is unreachable. Switch to Local AI for local inference.",
                provider=self.name, success=False,
            )
        except requests.exceptions.Timeout:
            logger.warning("OpenAI timed out after %ds", config.openai_timeout)
            return LLMResponse(
                text="OpenAI response timed out. Switch to Local AI for instant inference.",
                provider=self.name, success=False,
            )
        except Exception as exc:
            logger.error("OpenAI error: %s", exc)
            return LLMResponse(
                text="OpenAI encountered an error. Switch to Local AI.",
                provider=self.name, success=False,
            )
