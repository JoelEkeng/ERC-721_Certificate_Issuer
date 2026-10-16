"""SIWE (Sign-In with Ethereum) authentication flow.

Security properties:
- Nonce-based replay protection with atomic consumption.
- Domain, URI, and chain-ID binding to prevent relay attacks.
- Signature verification proves wallet ownership.
- Session tokens are HMAC-signed, stateless, and short-lived.
- An HTTP-submitted wallet address alone is NOT proof of ownership.
- Backend roles are verified server-side and documented.

Session token lifecycle:
- Tokens are signed with HMAC-SHA256 using a configurable secret.
- If SESSION_SECRET is empty, a random key is generated per-startup;
  all sessions are invalidated on restart.
- For production, set SESSION_SECRET to a stable base64-encoded 32+ byte
  value managed outside source control (e.g. via a secret manager).
- Tokens include address, chain_id, issued-at, and expiry claims.
- Constant-time comparison via hmac.compare_digest prevents timing attacks.
- Tokens are never logged or included in error responses.

Relationship to contract authority:
- Contract permissions (issueCertificate, revoke) are enforced on-chain.
- Backend auth gates administrative API routes only.
- A valid SIWE session does not grant contract permissions.
"""

from __future__ import annotations

import base64
import datetime
import hashlib
import hmac
import json
import logging
import secrets
import time

from fastapi import HTTPException, Request
from pydantic import BaseModel
from siwe import SiweMessage
from sqlalchemy import delete, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db.models import AuthNonce

logger = logging.getLogger(__name__)

# --- Session token secret ---
# If settings.session_secret is set, use it (stable across restarts).
# Otherwise, generate a random key per-startup (dev convenience).
_MIN_SECRET_BYTES = 32

if settings.session_secret:
    try:
        _raw = base64.b64decode(settings.session_secret)
        if len(_raw) < _MIN_SECRET_BYTES:
            raise ValueError(
                f"SESSION_SECRET must be at least {_MIN_SECRET_BYTES} bytes "
                f"when base64-decoded, got {len(_raw)}"
            )
        _SESSION_SECRET = _raw
    except Exception as exc:
        raise RuntimeError(f"Invalid SESSION_SECRET: {exc}") from exc
else:
    _SESSION_SECRET = secrets.token_bytes(32)
    logger.warning(
        "No SESSION_SECRET configured — using random per-startup key. "
        "Sessions will not survive restarts."
    )

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


def _sign_session_token(address: str, chain_id: int, issued_at: int, expires_at: int) -> str:
    """Create an HMAC-signed session token encoding address, chain, and expiry.

    Token format: ``<json-payload>.<hex-signature>``
    The payload is canonical JSON (sorted keys, no extra whitespace).
    """
    payload = json.dumps(
        {"address": address, "chain_id": chain_id, "iat": issued_at, "exp": expires_at},
        separators=(",", ":"),
        sort_keys=True,
    )
    sig = hmac.new(_SESSION_SECRET, payload.encode("utf-8"), hashlib.sha256).hexdigest()
    return f"{payload}.{sig}"


def _verify_session_token(token: str) -> dict | None:
    """Verify and decode an HMAC-signed session token.

    Returns the payload dict or None if invalid/expired/malformed.
    Uses constant-time comparison via hmac.compare_digest.
    """
    if not isinstance(token, str) or not token:
        return None

    parts = token.rsplit(".", 1)
    if len(parts) != 2:
        return None
    payload_str, sig = parts

    if not payload_str or not sig:
        return None

    expected_sig = hmac.new(
        _SESSION_SECRET, payload_str.encode("utf-8"), hashlib.sha256
    ).hexdigest()
    if not hmac.compare_digest(sig, expected_sig):
        return None

    try:
        payload = json.loads(payload_str)
    except (json.JSONDecodeError, ValueError):
        return None

    # Validate required claims
    if not isinstance(payload, dict):
        return None
    required = {"address", "chain_id", "exp"}
    if not required.issubset(payload.keys()):
        return None

    now = int(time.time())
    if payload.get("exp", 0) < now:
        return None

    return payload


async def cleanup_expired_nonces(session: AsyncSession) -> int:
    """Delete expired nonce records.

    Safe to call concurrently — only deletes nonces that are both
    expired AND already consumed (used=True), or expired by more than
    a generous grace period (2x TTL) to avoid interfering with
    in-flight authentication requests.
    """
    now = datetime.datetime.now(datetime.UTC)
    grace = datetime.timedelta(seconds=settings.siwe_nonce_ttl * 2)

    result = await session.execute(
        delete(AuthNonce).where(
            AuthNonce.expires_at < now - grace,
        )
    )
    await session.commit()
    return result.rowcount


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

    # --- Validate message fields BEFORE consuming the nonce ---

    # Domain check
    if siwe_message.domain != settings.siwe_domain:
        raise HTTPException(status_code=401, detail="Domain mismatch")

    # URI check
    if hasattr(siwe_message, "uri") and siwe_message.uri != settings.siwe_uri:
        raise HTTPException(status_code=401, detail="URI mismatch")

    # Chain ID check
    if int(siwe_message.chain_id) != settings.chain_id:
        raise HTTPException(status_code=401, detail="Chain ID mismatch")

    # --- Atomic nonce consumption ---
    # UPDATE ... WHERE used=false AND not expired.
    # This prevents TOCTOU races — only one concurrent request can succeed.
    now = datetime.datetime.now(datetime.UTC)
    result = await session.execute(
        update(AuthNonce)
        .where(
            AuthNonce.nonce == siwe_message.nonce,
            AuthNonce.used.is_(False),
            AuthNonce.expires_at >= now.replace(tzinfo=None),
        )
        .values(used=True)
    )
    await session.commit()

    if result.rowcount == 0:
        # Determine the reason for diagnostic message
        check = await session.execute(
            select(AuthNonce).where(AuthNonce.nonce == siwe_message.nonce)
        )
        nonce_record = check.scalar_one_or_none()
        if nonce_record is None:
            raise HTTPException(status_code=401, detail="Unknown nonce")
        if nonce_record.used:
            raise HTTPException(status_code=401, detail="Nonce already used")
        raise HTTPException(status_code=401, detail="Nonce expired")

    # --- Verify signature ---
    try:
        siwe_message.verify(signature)
    except Exception:
        raise HTTPException(status_code=401, detail="Signature verification failed") from None

    # --- Issue a signed session token ---
    now_ts = int(time.time())
    expires_at = now_ts + _SESSION_TTL
    token = _sign_session_token(
        siwe_message.address, int(siwe_message.chain_id), now_ts, expires_at
    )

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
