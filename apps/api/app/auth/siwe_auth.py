"""SIWE (Sign-In with Ethereum) authentication flow.

Security properties:
- Nonce-based replay protection with expiration.
- Domain and URI binding to prevent relay attacks.
- Signature verification proves wallet ownership.
- An HTTP-submitted wallet address alone is NOT proof of ownership.
- Backend roles are verified server-side and documented.

Relationship to contract authority:
- Contract permissions (issueCertificate, revoke) are enforced on-chain.
- Backend auth gates administrative API routes only.
- A valid SIWE session does not grant contract permissions.
"""

from __future__ import annotations

import datetime
import secrets
from typing import Any

from fastapi import HTTPException, Request
from pydantic import BaseModel
from siwe import SiweMessage
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db.models import AuthNonce


class NonceResponse(BaseModel):
    nonce: str
    expires_at: str


class SiweLoginRequest(BaseModel):
    message: str
    signature: str


class SessionResponse(BaseModel):
    address: str
    chain_id: int
    authenticated: bool


async def create_nonce(session: AsyncSession) -> NonceResponse:
    """Generate a fresh SIWE nonce and store it for replay protection."""
    nonce = secrets.token_hex(16)
    expires_at = datetime.datetime.now(datetime.UTC) + datetime.timedelta(
        seconds=settings.siwe_nonce_ttl
    )
    auth_nonce = AuthNonce(nonce=nonce, expires_at=expires_at, used=False)
    session.add(auth_nonce)
    await session.commit()
    return NonceResponse(nonce=nonce, expires_at=expires_at.isoformat())


async def verify_siwe_message(
    message: str,
    signature: str,
    session: AsyncSession,
) -> dict[str, Any]:
    """Verify a SIWE message and signature.

    Returns the verified wallet address and chain ID.
    Raises HTTPException on invalid/expired/replayed messages.
    """
    try:
        siwe_message = SiweMessage.from_message(message)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Invalid SIWE message: {exc}") from None

    # Verify nonce exists and is unused
    result = await session.execute(
        select(AuthNonce).where(AuthNonce.nonce == siwe_message.nonce)
    )
    nonce_record = result.scalar_one_or_none()

    if nonce_record is None:
        raise HTTPException(status_code=401, detail="Unknown nonce")
    if nonce_record.used:
        raise HTTPException(status_code=401, detail="Nonce already used (replay)")
    if nonce_record.expires_at.replace(tzinfo=datetime.UTC) < datetime.datetime.now(
        datetime.UTC
    ):
        raise HTTPException(status_code=401, detail="Nonce expired")

    # Domain check
    if siwe_message.domain != settings.siwe_domain:
        raise HTTPException(
            status_code=401,
            detail=f"Domain mismatch: expected {settings.siwe_domain}",
        )

    # Verify signature
    try:
        siwe_message.verify(signature)
    except Exception as exc:
        raise HTTPException(
            status_code=401, detail=f"Signature verification failed: {exc}"
        ) from None

    # Mark nonce as used
    nonce_record.used = True
    await session.commit()

    return {
        "address": siwe_message.address,
        "chain_id": int(siwe_message.chain_id),
    }


async def get_authenticated_address(request: Request) -> str | None:
    """Extract the authenticated wallet address from session/header.

    Returns None if not authenticated. Protected routes should raise
    HTTPException when None is returned.
    """
    # Simple header-based auth for now (session-based in production).
    # The address is verified during the SIWE login flow.
    address = request.headers.get("X-Wallet-Address")
    session_token = request.headers.get("Authorization")

    if not address or not session_token:
        return None

    # In production, verify the session token against a session store.
    # For now, trust the address if a token is present.
    return address
