"""API route definitions — versioned under /api/v1."""

from __future__ import annotations

import contextlib
import logging
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from .auth.siwe_auth import (
    NonceResponse,
    SessionResponse,
    SiweLoginRequest,
    create_nonce,
    get_authenticated_address,
    verify_siwe_message,
)
from .config import settings
from .contract import get_web3
from .contract import verify_certificate as chain_verify
from .db.engine import get_session
from .db.models import AuditLog, Certificate, IndexerCheckpoint, Institution
from .schemas import (
    AuditLogResponse,
    CertificateResponse,
    CertificateSearchResponse,
    ErrorResponse,
    HealthResponse,
    InstitutionResponse,
    TransactionResponse,
    VerifyResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter()


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------


@router.get("/health", response_model=HealthResponse)
async def health_check(
    session: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    """Check API health, RPC connectivity, and database status."""
    w3 = get_web3()
    rpc_connected = False
    with contextlib.suppress(Exception):
        rpc_connected = w3.is_connected()

    db_connected = False
    indexer_block = None
    try:
        result = await session.execute(
            select(IndexerCheckpoint.last_block).where(
                IndexerCheckpoint.chain_id == settings.chain_id,
                IndexerCheckpoint.contract_address == settings.contract_address,
            )
        )
        row = result.scalar_one_or_none()
        db_connected = True
        indexer_block = row
    except Exception:
        pass

    status = "ok"
    if not rpc_connected:
        status = "degraded"
    if not db_connected:
        status = "error"

    return {
        "status": status,
        "chain_id": settings.chain_id,
        "contract_address": settings.contract_address,
        "rpc_connected": rpc_connected,
        "database_connected": db_connected,
        "indexer_block": indexer_block,
    }


# ---------------------------------------------------------------------------
# Certificates (indexed)
# ---------------------------------------------------------------------------


@router.get(
    "/certificates/{token_id}",
    response_model=CertificateResponse,
    responses={404: {"model": ErrorResponse}},
)
async def get_certificate(
    token_id: int,
    chain_id: int = Query(default=None),
    session: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    """Fetch an indexed certificate by token ID.

    This returns indexed data (a projection). For authoritative verification,
    use the /verify endpoint which reads from the contract directly.
    """
    if token_id < 0:
        raise HTTPException(status_code=400, detail="Token ID must be non-negative")

    cid = chain_id or settings.chain_id
    result = await session.execute(
        select(Certificate).where(
            Certificate.chain_id == cid,
            Certificate.contract_address == settings.contract_address,
            Certificate.token_id == token_id,
        )
    )
    cert = result.scalar_one_or_none()
    if cert is None:
        raise HTTPException(
            status_code=404,
            detail=f"Certificate {token_id} not found in index. "
            "It may not have been indexed yet or does not exist.",
        )

    return _cert_to_dict(cert)


@router.get("/certificates", response_model=CertificateSearchResponse)
async def search_certificates(
    q: str = Query(default="", max_length=256, description="Search by name or course"),
    recipient: str = Query(default="", max_length=42, description="Filter by recipient wallet"),
    revoked: bool | None = Query(default=None, description="Filter by revocation status"),
    page: int = Query(default=1, ge=1, le=1000),
    page_size: int = Query(default=20, ge=1, le=100),
    session: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    """Search indexed certificates with pagination.

    Results are from the index and may lag behind chain state.
    """
    query = select(Certificate).where(
        Certificate.chain_id == settings.chain_id,
        Certificate.contract_address == settings.contract_address,
    )
    count_query = select(func.count()).select_from(Certificate).where(
        Certificate.chain_id == settings.chain_id,
        Certificate.contract_address == settings.contract_address,
    )

    if q:
        # Escape LIKE wildcards to prevent wildcard injection
        safe_q = q.replace("%", r"\%").replace("_", r"\_")
        like_pattern = f"%{safe_q}%"
        query = query.where(
            (Certificate.recipient_name.ilike(like_pattern))
            | (Certificate.course_title.ilike(like_pattern))
        )
        count_query = count_query.where(
            (Certificate.recipient_name.ilike(like_pattern))
            | (Certificate.course_title.ilike(like_pattern))
        )

    if recipient:
        query = query.where(Certificate.recipient_wallet.ilike(recipient))
        count_query = count_query.where(Certificate.recipient_wallet.ilike(recipient))

    if revoked is not None:
        query = query.where(Certificate.revoked == revoked)
        count_query = count_query.where(Certificate.revoked == revoked)

    total_result = await session.execute(count_query)
    total = total_result.scalar_one()

    offset = (page - 1) * page_size
    query = query.order_by(Certificate.token_id.desc()).offset(offset).limit(page_size)

    result = await session.execute(query)
    certs = result.scalars().all()

    return {
        "results": [_cert_to_dict(c) for c in certs],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


# ---------------------------------------------------------------------------
# On-chain verification (authoritative)
# ---------------------------------------------------------------------------

_STATUS_MAP = {0: "nonexistent", 1: "valid", 2: "revoked"}


@router.get(
    "/certificates/{token_id}/verify",
    response_model=VerifyResponse,
    responses={503: {"model": ErrorResponse}},
)
async def verify_certificate_endpoint(token_id: int) -> dict[str, Any]:
    """Verify a certificate directly from the smart contract.

    This is the authoritative verification source. The database index
    may accelerate discovery but cannot override contract state.
    """
    if token_id < 0:
        raise HTTPException(status_code=400, detail="Token ID must be non-negative")

    try:
        result = chain_verify(token_id)
    except Exception as exc:
        logger.error("Chain verification failed for token %d: %s", token_id, exc)
        raise HTTPException(
            status_code=503,
            detail="Unable to verify — blockchain network unavailable. "
            "This does NOT mean the certificate is invalid.",
        ) from None

    return {
        "token_id": token_id,
        "status": result["status"],
        "valid": result["valid"],
        "recipient_name": result.get("recipientName"),
        "course_title": result.get("courseTitle"),
        "issue_date": result.get("issueDate"),
        "owner": result.get("owner"),
        "revoked": result.get("revoked"),
        "data_source": "on-chain",
    }


# ---------------------------------------------------------------------------
# Institutions
# ---------------------------------------------------------------------------


@router.get(
    "/institutions/{address}",
    response_model=InstitutionResponse,
    responses={404: {"model": ErrorResponse}},
)
async def get_institution(
    address: str,
    session: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    """Look up institution profile by contract or owner address."""
    result = await session.execute(
        select(Institution).where(
            (Institution.contract_address.ilike(address))
            | (Institution.owner_address.ilike(address))
        )
    )
    inst = result.scalar_one_or_none()
    if inst is None:
        raise HTTPException(status_code=404, detail="Institution not found")

    # Count certificates
    count_result = await session.execute(
        select(func.count()).select_from(Certificate).where(
            Certificate.chain_id == inst.chain_id,
            Certificate.contract_address == inst.contract_address,
        )
    )
    cert_count = count_result.scalar_one()

    return {
        "chain_id": inst.chain_id,
        "contract_address": inst.contract_address,
        "owner_address": inst.owner_address,
        "name": inst.name,
        "certificates_issued": cert_count,
    }


# ---------------------------------------------------------------------------
# Transactions
# ---------------------------------------------------------------------------


@router.get(
    "/transactions/{tx_hash}",
    response_model=TransactionResponse,
    responses={404: {"model": ErrorResponse}},
)
async def get_transaction(
    tx_hash: str,
    session: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    """Look up a certificate-related transaction by hash."""
    # Check issuance
    result = await session.execute(
        select(Certificate).where(Certificate.issue_tx_hash.ilike(tx_hash))
    )
    cert = result.scalar_one_or_none()
    if cert is not None:
        return {
            "tx_hash": cert.issue_tx_hash,
            "block_number": cert.issue_block_number,
            "chain_id": cert.chain_id,
            "contract_address": cert.contract_address,
            "event_type": "issuance",
            "token_id": cert.token_id,
        }

    # Check revocation
    result = await session.execute(
        select(Certificate).where(Certificate.revoke_tx_hash.ilike(tx_hash))
    )
    cert = result.scalar_one_or_none()
    if cert is not None:
        return {
            "tx_hash": cert.revoke_tx_hash,
            "block_number": cert.revoke_block_number,
            "chain_id": cert.chain_id,
            "contract_address": cert.contract_address,
            "event_type": "revocation",
            "token_id": cert.token_id,
        }

    raise HTTPException(status_code=404, detail="Transaction not found in index")


# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------


@router.post("/auth/nonce", response_model=NonceResponse)
async def get_nonce(
    session: AsyncSession = Depends(get_session),
) -> NonceResponse:
    """Generate a fresh SIWE nonce for authentication."""
    return await create_nonce(session)


@router.post("/auth/login", response_model=SessionResponse)
async def siwe_login(
    body: SiweLoginRequest,
    session: AsyncSession = Depends(get_session),
) -> SessionResponse:
    """Verify a SIWE signed message and establish a session."""
    return await verify_siwe_message(body.message, body.signature, session)


# ---------------------------------------------------------------------------
# Admin (auth-protected)
# ---------------------------------------------------------------------------


@router.get("/admin/audit", response_model=list[AuditLogResponse])
async def get_audit_logs(
    limit: int = Query(default=50, ge=1, le=200),
    session: AsyncSession = Depends(get_session),
    address: str | None = Depends(get_authenticated_address),
) -> list[dict[str, Any]]:
    """Fetch recent audit logs. Requires authentication."""
    if address is None:
        raise HTTPException(status_code=401, detail="Authentication required")

    result = await session.execute(
        select(AuditLog).order_by(AuditLog.created_at.desc()).limit(limit)
    )
    logs = result.scalars().all()
    return [
        {
            "action": log.action,
            "actor": log.actor,
            "detail": log.detail,
            "created_at": log.created_at.isoformat() if log.created_at else "",
        }
        for log in logs
    ]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _cert_to_dict(cert: Certificate) -> dict[str, Any]:
    return {
        "token_id": cert.token_id,
        "chain_id": cert.chain_id,
        "contract_address": cert.contract_address,
        "recipient_wallet": cert.recipient_wallet,
        "recipient_name": cert.recipient_name,
        "course_title": cert.course_title,
        "issue_timestamp": cert.issue_timestamp,
        "issue_tx_hash": cert.issue_tx_hash,
        "issue_block_number": cert.issue_block_number,
        "revoked": cert.revoked,
        "revoke_tx_hash": cert.revoke_tx_hash,
        "revoke_block_number": cert.revoke_block_number,
        "data_source": "indexed",
    }
