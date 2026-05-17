"""
main.py — FastAPI application entry point.

All business logic lives in routes/, analysis/, collectors/, and clients/.
This file only wires things together: routers, middleware, startup logging.

Run locally:
  uvicorn apps.api.src.main:app --reload --port 8000
"""
import logging

from fastapi import FastAPI

from .config              import config
from .middleware.cors      import add_cors
from .middleware.logging   import add_logging
from .middleware.rate_limit import add_rate_limit
from .routes.anomalies    import router as anomalies_router
from .routes.graph        import router as graph_router
from .routes.health       import router as health_router
from .routes.insights     import router as insights_router
from .routes.pods         import router as pods_router

logging.basicConfig(
    level=config.log_level.upper(),
    format="%(asctime)s  %(levelname)-8s  %(name)s  %(message)s",
)
logger = logging.getLogger("api")

app = FastAPI(
    title="AI Pod Observer — API",
    description="Kubernetes observability backend with AI-powered insights.",
    version="1.0.0",
)

# Middleware registration order matters: logging → rate_limit → cors.
# Requests flow outer-in, so logging wraps everything.
add_logging(app)
add_rate_limit(app)
add_cors(app)

# Route registration
app.include_router(health_router)
app.include_router(pods_router)
app.include_router(anomalies_router)
app.include_router(graph_router)
app.include_router(insights_router)


@app.on_event("startup")
async def _startup():
    logger.info("AI Pod Observer API starting on %s:%d", config.host, config.port)
    logger.info("Endpoints: /health /pods /anomalies /graph /insights  ws://.../live")
    logger.info("AI service: %s", config.ai_service_url)
