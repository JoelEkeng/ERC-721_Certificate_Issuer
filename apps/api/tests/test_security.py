"""Security regression tests for rate limiting, auth, and session tokens."""

from __future__ import annotations

import datetime
import time

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.siwe_auth import (
    _sign_session_token,
    _verify_session_token,
    cleanup_expired_nonces,
)
from app.db.models import AuthNonce
from app.rate_limit import limiter

# =========================================================================
# Rate limiting
# =========================================================================


@pytest.fixture(autouse=True)
def _reset_rate_limiter():
    """Reset rate limiter state between tests to avoid cross-test pollution."""
    limiter.reset()
    yield
    limiter.reset()


@pytest.mark.asyncio
async def test_nonce_endpoint_rate_limited(client: AsyncClient):
    """The /auth/nonce endpoint should return 429 after exceeding 10/min."""
    # The limit is 10/minute — send 10 that succeed, then the 11th is blocked
    for i in range(10):
        resp = await client.post("/api/v1/auth/nonce")
        assert resp.status_code == 200, f"Request {i+1} failed unexpectedly"

    # 11th request should be rate limited
    resp = await client.post("/api/v1/auth/nonce")
    assert resp.status_code == 429
    assert "Rate limit exceeded" in resp.json()["detail"]


@pytest.mark.asyncio
async def test_search_endpoint_rate_limited(client: AsyncClient):
    """The search endpoint should enforce its rate limit (60/min)."""
    for i in range(60):
        resp = await client.get("/api/v1/certificates")
        assert resp.status_code == 200, f"Request {i+1} failed unexpectedly"

    # 61st request should be rate limited
    resp = await client.get("/api/v1/certificates")
    assert resp.status_code == 429


# =========================================================================
# Nonce lifecycle
# =========================================================================


def _build_siwe_message(
    nonce: str,
    domain: str = "localhost",
    chain_id: int = 31337,
    address: str = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
) -> str:
    """Build a well-formed SIWE message string for testing."""
    return (
        f"{domain} wants you to sign in with your Ethereum account:\n"
        f"{address}\n"
        f"\n"
        f"\n"
        f"URI: http://localhost:3000\n"
        f"Version: 1\n"
        f"Chain ID: {chain_id}\n"
        f"Nonce: {nonce}\n"
        f"Issued At: 2024-01-01T00:00:00Z"
    )


@pytest.mark.asyncio
async def test_expired_nonce_cannot_authenticate(client: AsyncClient, test_session: AsyncSession):
    """An expired nonce should not allow authentication."""
    nonce = AuthNonce(
        nonce="expiredtestnonce1234",
        expires_at=datetime.datetime.now(datetime.UTC) - datetime.timedelta(minutes=10),
        used=False,
    )
    test_session.add(nonce)
    await test_session.commit()

    resp = await client.post(
        "/api/v1/auth/login",
        json={
            "message": _build_siwe_message("expiredtestnonce1234"),
            "signature": "0x" + "00" * 65,
        },
    )
    assert resp.status_code == 401
    detail = resp.json()["detail"].lower()
    assert "expired" in detail or "nonce" in detail


@pytest.mark.asyncio
async def test_reused_nonce_rejected(client: AsyncClient, test_session: AsyncSession):
    """A nonce that has already been consumed should be rejected."""
    nonce = AuthNonce(
        nonce="usedtestnonce12345678",
        expires_at=datetime.datetime.now(datetime.UTC) + datetime.timedelta(minutes=5),
        used=True,
    )
    test_session.add(nonce)
    await test_session.commit()

    resp = await client.post(
        "/api/v1/auth/login",
        json={
            "message": _build_siwe_message("usedtestnonce12345678"),
            "signature": "0x" + "00" * 65,
        },
    )
    assert resp.status_code == 401
    detail = resp.json()["detail"].lower()
    assert "already used" in detail or "nonce" in detail


@pytest.mark.asyncio
async def test_nonce_cleanup(test_session: AsyncSession):
    """Cleanup should delete old expired nonces without touching active ones."""
    now = datetime.datetime.now(datetime.UTC)

    # Expired long ago (should be cleaned)
    old_nonce = AuthNonce(
        nonce="old_expired",
        expires_at=now - datetime.timedelta(hours=1),
        used=True,
    )
    # Recently expired (within grace period — should NOT be cleaned)
    recent_nonce = AuthNonce(
        nonce="recent_expired",
        expires_at=now - datetime.timedelta(seconds=30),
        used=False,
    )
    # Active (should NOT be cleaned)
    active_nonce = AuthNonce(
        nonce="active",
        expires_at=now + datetime.timedelta(minutes=5),
        used=False,
    )
    test_session.add_all([old_nonce, recent_nonce, active_nonce])
    await test_session.commit()

    cleaned = await cleanup_expired_nonces(test_session)
    assert cleaned == 1  # Only the old expired nonce

    from sqlalchemy import select

    result = await test_session.execute(select(AuthNonce))
    remaining = result.scalars().all()
    remaining_nonces = {n.nonce for n in remaining}
    assert "old_expired" not in remaining_nonces
    assert "recent_expired" in remaining_nonces
    assert "active" in remaining_nonces


# =========================================================================
# Session token lifecycle
# =========================================================================


def test_valid_session_token():
    """A correctly signed, non-expired token should verify."""
    now = int(time.time())
    token = _sign_session_token("0xABCD", 31337, now, now + 3600)
    payload = _verify_session_token(token)
    assert payload is not None
    assert payload["address"] == "0xABCD"
    assert payload["chain_id"] == 31337


def test_expired_session_token_rejected():
    """An expired session token should be rejected."""
    now = int(time.time())
    token = _sign_session_token("0xABCD", 31337, now - 7200, now - 3600)
    payload = _verify_session_token(token)
    assert payload is None


def test_forged_session_token_rejected():
    """A token with a tampered signature should be rejected."""
    now = int(time.time())
    token = _sign_session_token("0xABCD", 31337, now, now + 3600)
    parts = token.rsplit(".", 1)
    forged = parts[0] + ".0000000000000000000000000000000000000000000000000000000000000000"
    payload = _verify_session_token(forged)
    assert payload is None


def test_tampered_payload_rejected():
    """A token with a modified payload should be rejected."""
    now = int(time.time())
    token = _sign_session_token("0xABCD", 31337, now, now + 3600)
    parts = token.rsplit(".", 1)
    tampered_payload = parts[0].replace("0xABCD", "0xEVIL")
    forged = tampered_payload + "." + parts[1]
    payload = _verify_session_token(forged)
    assert payload is None


def test_malformed_tokens_rejected():
    """Various malformed tokens should all be rejected."""
    assert _verify_session_token("") is None
    assert _verify_session_token("no-dot-here") is None
    assert _verify_session_token("not.json.data") is None
    assert _verify_session_token(".empty-payload") is None
    assert _verify_session_token("{}." + "a" * 64) is None  # Missing required claims
    assert _verify_session_token(None) is None  # type: ignore[arg-type]


@pytest.mark.asyncio
async def test_wrong_domain_rejected(client: AsyncClient, test_session: AsyncSession):
    """A SIWE message with the wrong domain should be rejected."""
    nonce = AuthNonce(
        nonce="domaintestnonce12345",
        expires_at=datetime.datetime.now(datetime.UTC) + datetime.timedelta(minutes=5),
        used=False,
    )
    test_session.add(nonce)
    await test_session.commit()

    resp = await client.post(
        "/api/v1/auth/login",
        json={
            "message": _build_siwe_message("domaintestnonce12345", domain="evil.com"),
            "signature": "0x" + "00" * 65,
        },
    )
    assert resp.status_code == 401
    assert "domain" in resp.json()["detail"].lower()


@pytest.mark.asyncio
async def test_wrong_chain_rejected(client: AsyncClient, test_session: AsyncSession):
    """A SIWE message with the wrong chain ID should be rejected."""
    nonce = AuthNonce(
        nonce="chaintestnonce123456",
        expires_at=datetime.datetime.now(datetime.UTC) + datetime.timedelta(minutes=5),
        used=False,
    )
    test_session.add(nonce)
    await test_session.commit()

    resp = await client.post(
        "/api/v1/auth/login",
        json={
            "message": _build_siwe_message("chaintestnonce123456", chain_id=1),
            "signature": "0x" + "00" * 65,
        },
    )
    assert resp.status_code == 401
    assert "chain" in resp.json()["detail"].lower()
