"""FastAPI application entry point."""

from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .routes import router

app = FastAPI(
    title="On-Chain Certificate Issuer API",
    description=(
        "Backend API for the On-Chain Certificate Issuer. "
        "Provides read-only access to certificate data from the blockchain. "
        "Write operations (issue, revoke) are performed client-side via wallet signing."
    ),
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["GET"],
    allow_headers=["*"],
)

app.include_router(router, prefix="/api/v1")


@app.get("/")
async def root() -> dict:
    return {
        "name": "On-Chain Certificate Issuer API",
        "version": "1.0.0",
        "docs": "/docs",
    }
