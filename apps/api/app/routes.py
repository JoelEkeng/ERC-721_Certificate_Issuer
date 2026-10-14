"""API route definitions."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException

from .config import settings
from .contract import (
    get_certificate,
    get_certificate_events,
    get_token_uri,
    get_web3,
    verify_certificate,
)
from .schemas import (
    CertificateEvent,
    CertificateResponse,
    HealthResponse,
    VerifyResponse,
)

router = APIRouter()


@router.get("/health", response_model=HealthResponse)
async def health_check() -> dict:
    """Check API health and RPC connectivity."""
    w3 = get_web3()
    connected = False
    try:
        connected = w3.is_connected()
    except Exception:
        pass

    return {
        "status": "ok" if connected else "degraded",
        "chain_id": settings.chain_id,
        "contract_address": settings.contract_address,
        "rpc_connected": connected,
    }


@router.get("/certificates/{token_id}", response_model=CertificateResponse)
async def get_certificate_by_id(token_id: int) -> dict:
    """Fetch a certificate by its token ID."""
    if token_id < 0:
        raise HTTPException(status_code=400, detail="Token ID must be non-negative")

    cert = get_certificate(token_id)
    if cert is None:
        raise HTTPException(status_code=404, detail=f"Certificate {token_id} does not exist")

    return cert


@router.get("/certificates/{token_id}/verify", response_model=VerifyResponse)
async def verify_certificate_by_id(token_id: int) -> dict:
    """
    Verify a certificate's authenticity and status.
    Returns status as one of: valid, revoked, nonexistent.
    """
    if token_id < 0:
        raise HTTPException(status_code=400, detail="Token ID must be non-negative")

    return verify_certificate(token_id)


@router.get("/certificates/{token_id}/metadata")
async def get_certificate_metadata(token_id: int) -> dict:
    """Fetch the on-chain tokenURI (base64-encoded JSON with SVG image)."""
    if token_id < 0:
        raise HTTPException(status_code=400, detail="Token ID must be non-negative")

    uri = get_token_uri(token_id)
    if uri is None:
        raise HTTPException(status_code=404, detail=f"Certificate {token_id} does not exist")

    return {"tokenId": token_id, "tokenURI": uri}


@router.get("/certificates", response_model=list[CertificateEvent])
async def list_certificates() -> list[dict]:
    """
    List all issued certificates by reading on-chain events.
    Note: This reads from the RPC node's event logs, not a local database.
    """
    return get_certificate_events()
