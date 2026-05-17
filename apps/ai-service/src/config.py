"""
config.py — AI service settings.

All LLM provider config in one place. The service selects a provider at
startup based on whether OPENAI_API_KEY is set — no code changes needed
to switch between Local (Ollama) and Cloud (OpenAI) inference.
"""
import os
from dataclasses import dataclass, field


@dataclass(frozen=True)
class AIConfig:
    # ── Ollama ─────────────────────────────────────────────────────────────────
    ollama_host:  str = field(default_factory=lambda: os.getenv("OLLAMA_HOST",  "http://localhost:11434"))
    ollama_model: str = field(default_factory=lambda: os.getenv("OLLAMA_MODEL", "llama3.2:1b"))

    # ── OpenAI ─────────────────────────────────────────────────────────────────
    openai_api_key: str = field(default_factory=lambda: os.getenv("OPENAI_API_KEY", ""))
    openai_model:   str = field(default_factory=lambda: os.getenv("OPENAI_MODEL",   "gpt-4o-mini"))

    # ── Inference timeouts ─────────────────────────────────────────────────────
    # llama3.2:1b on 8GB RAM can take 60–90s on first inference (model load).
    # Subsequent calls are faster (~5–15s) because Ollama keeps the model hot.
    ollama_timeout: int = field(default_factory=lambda: int(os.getenv("OLLAMA_TIMEOUT", "90")))
    openai_timeout: int = field(default_factory=lambda: int(os.getenv("OPENAI_TIMEOUT", "30")))

    # ── Server ─────────────────────────────────────────────────────────────────
    host:      str = field(default_factory=lambda: os.getenv("HOST",      "0.0.0.0"))
    port:      int = field(default_factory=lambda: int(os.getenv("PORT",  "8001")))
    log_level: str = field(default_factory=lambda: os.getenv("LOG_LEVEL", "info"))


config = AIConfig()
