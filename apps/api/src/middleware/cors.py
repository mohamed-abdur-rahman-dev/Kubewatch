"""
cors.py — CORS middleware setup.

Extracted from main.py so the CORS policy is visible in one place.
Wildcard origins are intentional for this local demo — tighten before production.
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from ..config import config


def add_cors(app: FastAPI) -> None:
    """Attach CORSMiddleware to *app* using settings from config."""
    app.add_middleware(
        CORSMiddleware,
        allow_origins=config.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
