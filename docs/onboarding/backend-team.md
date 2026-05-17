# Backend Onboarding

## Stack

- **FastAPI** 0.111 + **Uvicorn** — async HTTP server
- **Pydantic v2** — models use `model_dump()` (not `.dict()`)
- **kubernetes Python client** 29.0 — `CoreV1Api`, `CustomObjectsApi`
- **httpx** — async HTTP client used by `ai_client.py` to call the ai-service

## Local Dev

```bash
cd apps/api
python -m venv .venv
.venv\Scripts\activate          # Windows
pip install -r requirements-dev.txt
uvicorn src.main:app --reload --port 8000
```

The ai-service must be running at port 8001 for `/insights` to work.
A stopped ai-service returns a fallback string — it never crashes the API.

## Project Layout

```
apps/api/src/
├── config.py           — AppConfig dataclass (all env vars)
├── main.py             — FastAPI app, middleware, router registration
├── models/             — Pydantic data shapes (pod, anomaly, graph, insight)
├── collectors/         — Kubernetes API polling + 10s cache
├── analysis/           — rules.py (thresholds) + dependency.py (graph edges)
├── routes/             — one file per API endpoint group
├── clients/            — ai_client.py (HTTP calls to ai-service)
└── middleware/         — cors.py, rate_limit.py, logging.py
```

## Key Design Decisions

**Pod cache in collector, not main.py** — `get_cached_pods()` lives in
`k8s_collector.py` to avoid circular imports. Routes import the collector;
main.py imports routes. If the cache lived in main.py, routes would need to
import from the entry point.

**`infer_dependencies` in its own file** — `rules.py` has zero k8s-client
imports so it can be unit tested with plain `PodMetric` objects. Dependency
inference (which reads Service selectors) is in `dependency.py`.

**API service never talks to Ollama** — `ai_client.py` calls the ai-service
via HTTP. This means LLM logic, model config, and inference timeout all live
in one place (`apps/ai-service`).

## Running Tests

```bash
cd apps/api
pytest tests/unit/          # fast — no cluster needed
pytest tests/integration/   # patches get_cached_pods — no cluster needed
```
