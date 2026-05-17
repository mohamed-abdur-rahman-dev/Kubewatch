"""
config.py — Centralised application settings.

All knobs live here. Routes and services read from this dataclass instead of
calling os.getenv() scattered across the codebase, making the config surface
explicit and testable.
"""
import os
from dataclasses import dataclass, field


@dataclass(frozen=True)
class AppConfig:
    # ── Server ─────────────────────────────────────────────────────────────────
    host: str = field(default_factory=lambda: os.getenv("HOST", "0.0.0.0"))
    port: int = field(default_factory=lambda: int(os.getenv("PORT", "8000")))
    log_level: str = field(default_factory=lambda: os.getenv("LOG_LEVEL", "info"))

    # ── Kubernetes polling ─────────────────────────────────────────────────────
    collect_interval: int = field(
        default_factory=lambda: int(os.getenv("COLLECT_INTERVAL", "15"))
    )
    pod_cache_ttl: int = field(
        default_factory=lambda: int(os.getenv("POD_CACHE_TTL", "10"))
    )

    # ── AI service ─────────────────────────────────────────────────────────────
    # The API service calls apps/ai-service via HTTP — never talks to Ollama directly.
    ai_service_url: str = field(
        default_factory=lambda: os.getenv("AI_SERVICE_URL", "http://localhost:8001")
    )
    insight_cache_ttl: int = field(
        default_factory=lambda: int(os.getenv("INSIGHT_CACHE_TTL", "20"))
    )

    # ── CORS ───────────────────────────────────────────────────────────────────
    # Wildcard is intentional for the demo — not for production.
    cors_origins: list = field(default_factory=lambda: ["*"])


# Singleton used across all modules — import this, never instantiate a new one.
config = AppConfig()
