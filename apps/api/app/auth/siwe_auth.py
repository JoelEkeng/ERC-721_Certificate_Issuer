"""SIWE (Sign-In with Ethereum) authentication flow.

Security properties:
- Nonce-based replay protection with atomic consumption.
- Domain, URI, and chain-ID binding to prevent relay attacks.
- Signature verification proves wallet ownership.
- Session tokens are HMAC-signed, stateless, and short-lived.
- An HTTP-submitted wallet address alone is NOT proof of ownership.
- Backend roles are verified server-side and documented.

Relationship to contract authority:
- Contract permissions (issueCertificate, revoke) are enforced on-chain.
- Backend auth gates administrative API routes only.
- A valid SIWE session does not grant contract permissions.
"""

from __future__ import annotations

import datetime
import hashlib
import hmac
import json
import secrets
import time

from fastapi import HTTPException, Request
from pydantic import BaseModel
from siwe import SiweMessage
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db.models import AuthNonce

# Session token signing key — derived from a secret or random per-startup
_SESSION_SECRET = secrets.token_bytes(32)
_SESSION_TTL = 3600  # 1 hour


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
    session_token: str


def _sign_session_token(address: str, chain_id: int, expires_at: int) -> str:
    """Create an HMAC-signed session token encoding address, chain, and expiry."""
    payload = json.dumps(
        {"address": address, "chain_id": chain_id, "exp": expires_at},
        separators=(",", ":"),
    )
    sig = hmac.new(_SESSION_SECRET, payload.encode(), hashlib.sha256).hexdigest()
    # Token format: base payload + "." + signature
    return f"{payload}.{sig}"


def _verify_session_token(token: str) -> dict | None:
    """Verify and decode an HMAC-signed session token.

    Returns the payload dict or None if invalid/expired.
    """
    parts = token.rsplit(".", 1)
    if len(parts) != 2:
        return None
    payload_str, sig = parts

    expected_sig = hmac.new(
        _SESSION_SECRET, payload_str.encode(), hashlib.sha256
    ).hexdigest()
    if not hmac.compare_digest(sig, expected_sig):
        return None

    try:
        payload = json.loads(payload_str)
    except (json.JSONDecodeError, ValueError):
        return None

    if payload.get("exp", 0) < int(time.time()):
        return None

    return payload


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
) -> SessionResponse:
    """Verify a SIWE message and signature, issue a session token.

    Returns a SessionResponse with address, chain_id, and signed session_token.
    Raises HTTPException on invalid/expired/replayed messages.
    """
    try:
        siwe_message = SiweMessage.from_message(message)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid SIWE message format") from None

    # Atomic nonce consumption: UPDATE ... WHERE used=false
    # This prevents TOCTOU races — only one concurrent request can succeed.
    result = await session.execute(
        update(AuthNonce)
        .where(
            AuthNonce.nonce == siwe_message.nonce,
            AuthNonce.used.is_(False),
        )
        .values(used=True)
    )
    await session.commit()

    if result.rowcount == 0:
        # Nonce not found, already used, or expired — check why for the error message
        check = await session.execute(
            select(AuthNonce).where(AuthNonce.nonce == siwe_message.nonce)
        )
        nonce_record = check.scalar_one_or_none()
        if nonce_record is None:
            raise HTTPException(status_code=401, detail="Unknown nonce")
        if nonce_record.used:
            raise HTTPException(status_code=401, detail="Nonce already used")
        raise HTTPException(status_code=401, detail="Nonce expired")

    # Check nonce expiration
    check = await session.execute(
        select(AuthNonce).where(AuthNonce.nonce == siwe_message.nonce)
    )
    nonce_record = check.scalar_one_or_none()
    if nonce_record and nonce_record.expires_at.replace(
        tzinfo=datetime.UTC
    ) < datetime.datetime.now(datetime.UTC):
        raise HTTPException(status_code=401, detail="Nonce expired")

    # Domain check
    if siwe_message.domain != settings.siwe_domain:
        raise HTTPException(status_code=401, detail="Domain mismatch")

    # URI check
    if hasattr(siwe_message, "uri") and siwe_message.uri != settings.siwe_uri:
        raise HTTPException(status_code=401, detail="URI mismatch")

    # Chain ID check
    if int(siwe_message.chain_id) != settings.chain_id:
        raise HTTPException(status_code=401, detail="Chain ID mismatch")

    # Verify signature — generic error to avoid leaking internals
    try:
        siwe_message.verify(signature)
    except Exception:
        raise HTTPException(status_code=401, detail="Signature verification failed") from None

    # Issue a signed session token
    expires_at = int(time.time()) + _SESSION_TTL
    token = _sign_session_token(siwe_message.address, int(siwe_message.chain_id), expires_at)

    return SessionResponse(
        address=siwe_message.address,
        chain_id=int(siwe_message.chain_id),
        authenticated=True,
        session_token=token,
    )


async def get_authenticated_address(request: Request) -> str | None:
    """Extract the authenticated wallet address from a verified session token.

    Returns None if not authenticated. Protected routes should raise
    HTTPException when None is returned.
    """
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        return None

    token = auth_header[7:]  # Strip "Bearer "
    payload = _verify_session_token(token)
    if payload is None:
        return None

    return payload.get("address")
