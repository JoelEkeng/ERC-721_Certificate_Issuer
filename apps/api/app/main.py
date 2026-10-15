"""FastAPI application entry point."""

from __future__ import annotations

import asyncio
import contextlib
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .db.engine import engine
from .db.models import Base
from .indexer.service import run_indexer_loop
from .routes import router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)-8s %(name)s — %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application startup and shutdown lifecycle."""
    # Create tables (in dev). In production, use Alembic migrations.
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logger.info("Database tables ensured")

    # Start the background indexer
    indexer_task = asyncio.create_task(run_indexer_loop())
    logger.info("Background indexer started")

    yield

    # Shutdown: cancel the indexer
    indexer_task.cancel()
    with contextlib.suppress(asyncio.CancelledError):
        await indexer_task
    logger.info("Indexer stopped")

    # Dispose engine
    await engine.dispose()


app = FastAPI(
    title="On-Chain Certificate Issuer API",
    description=(
        "Backend API for the On-Chain Certificate Issuer. "
        "Provides indexed certificate search, on-chain verification, "
        "and SIWE-based authentication. Write operations (issue, revoke) "
        "are performed client-side via wallet signing — the backend "
        "never holds private keys."
    ),
    version="2.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

app.include_router(router, prefix="/api/v1")


@app.get("/")
async def root() -> dict:
    return {
        "name": "On-Chain Certificate Issuer API",
        "version": "2.0.0",
        "docs": "/docs",
        "health": "/api/v1/health",
    }
