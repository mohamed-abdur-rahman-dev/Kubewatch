"""
main.py — AI service entry point (port 8001).

This service is the only thing that talks to Ollama or OpenAI.
The API service (apps/api) calls POST /generate via HTTP, keeping
LLM logic in one deployable unit that can be scaled independently.

Run locally:
  uvicorn apps.ai-service.src.main:app --reload --port 8001
"""
import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .cache.insight_cache       import InsightCache
from .config                    import config
from .models                    import InsightRequest, InsightResponse
from .parsers.response_parser   import parse_insight_sections
from .prompts.cloud_prompt      import build_cloud_prompt
from .prompts.local_prompt      import build_local_prompt
from .providers.ollama          import OllamaProvider
from .providers.openai          import OpenAIProvider

logging.basicConfig(
    level=config.log_level.upper(),
    format="%(asctime)s  %(levelname)-8s  %(name)s  %(message)s",
)
logger = logging.getLogger("ai-service")

app = FastAPI(
    title="AI Pod Observer — AI Service",
    description="LLM inference microservice for Kubernetes cluster insights.",
    version="1.0.0",
)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

_ollama_provider = OllamaProvider()
_openai_provider = OpenAIProvider()
_cache           = InsightCache(ttl_seconds=20)


def _select_provider(requested: str):
    """Return the appropriate provider. OpenAI wins if key is set and no override."""
    if requested == "ollama":
        return _ollama_provider
    if requested == "openai":
        return _openai_provider
    # Auto-select: use OpenAI when key is configured, local otherwise
    return _openai_provider if config.openai_api_key else _ollama_provider


@app.get("/health")
def health():
    """Liveness probe."""
    return {"status": "ok", "version": "1.0.0"}


@app.get("/providers")
def list_providers():
    """Return which providers are available (configured) at runtime."""
    return {
        "ollama": {
            "available": True,  # always listed — fails gracefully if not running
            "host":      config.ollama_host,
            "model":     config.ollama_model,
        },
        "openai": {
            "available": bool(config.openai_api_key),
            "model":     config.openai_model,
        },
        "default": "openai" if config.openai_api_key else "ollama",
    }


@app.post("/generate", response_model=InsightResponse)
def generate_insight(body: InsightRequest):
    """Generate an LLM insight from the provided cluster state."""
    cached = _cache.get()
    if cached is not None:
        return cached

    provider = _select_provider(body.provider)

    if provider.name == "openai":
        prompt = build_cloud_prompt(body.pods, body.anomalies, body.snapshot)
    else:
        prompt = build_local_prompt(body.pods, body.anomalies, body.snapshot)

    logger.info("Generating insight with %s", provider.name)
    llm_response = provider.generate(prompt)

    sections = parse_insight_sections(llm_response.text)
    result   = InsightResponse(
        insight=llm_response.text,
        provider=provider.name,
        sections=sections,
    )
    if llm_response.success:
        _cache.set(result)
    return result


@app.on_event("startup")
async def _startup():
    logger.info("AI service starting on %s:%d", config.host, config.port)
    logger.info("Default provider: %s", "openai" if config.openai_api_key else "ollama")
    logger.info("Ollama: %s  model: %s", config.ollama_host, config.ollama_model)
