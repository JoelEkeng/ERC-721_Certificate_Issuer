"""API endpoint tests — uses in-memory SQLite, no Anvil required."""

from __future__ import annotations

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Certificate, Institution


@pytest.mark.asyncio
async def test_root(client: AsyncClient):
    resp = await client.get("/")
    assert resp.status_code == 200
    data = resp.json()
    assert data["name"] == "On-Chain Certificate Issuer API"
    assert "docs" in data


@pytest.mark.asyncio
async def test_health(client: AsyncClient):
    resp = await client.get("/api/v1/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["chain_id"] == 31337
    assert "database_connected" in data


@pytest.mark.asyncio
async def test_certificate_not_found(client: AsyncClient):
    resp = await client.get("/api/v1/certificates/999")
    assert resp.status_code == 404
    assert "not found" in resp.json()["detail"].lower()


@pytest.mark.asyncio
async def test_certificate_negative_id(client: AsyncClient):
    resp = await client.get("/api/v1/certificates/-1")
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_search_empty(client: AsyncClient):
    resp = await client.get("/api/v1/certificates")
    assert resp.status_code == 200
    data = resp.json()
    assert data["results"] == []
    assert data["total"] == 0
    assert data["page"] == 1


@pytest.mark.asyncio
async def test_search_with_results(client: AsyncClient, test_session: AsyncSession):
    # Insert a test certificate
    cert = Certificate(
        chain_id=31337,
        contract_address="0x5FbDB2315678afecb367f032d93F642f64180aa3",
        token_id=0,
        recipient_wallet="0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
        recipient_name="Alice Test",
        course_title="Solidity 101",
        issue_timestamp=1700000000,
        issue_tx_hash="0x" + "a" * 64,
        issue_block_number=1,
        revoked=False,
    )
    test_session.add(cert)
    await test_session.commit()

    resp = await client.get("/api/v1/certificates?q=Alice")
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 1
    assert data["results"][0]["recipient_name"] == "Alice Test"
    assert data["results"][0]["data_source"] == "indexed"


@pytest.mark.asyncio
async def test_search_by_recipient_wallet(client: AsyncClient, test_session: AsyncSession):
    cert = Certificate(
        chain_id=31337,
        contract_address="0x5FbDB2315678afecb367f032d93F642f64180aa3",
        token_id=1,
        recipient_wallet="0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
        recipient_name="Bob",
        course_title="Web3 Advanced",
        issue_timestamp=1700000000,
        issue_tx_hash="0x" + "b" * 64,
        issue_block_number=2,
        revoked=False,
    )
    test_session.add(cert)
    await test_session.commit()

    resp = await client.get(
        "/api/v1/certificates?recipient=0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC"
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 1
    assert data["results"][0]["recipient_name"] == "Bob"


@pytest.mark.asyncio
async def test_search_pagination(client: AsyncClient, test_session: AsyncSession):
    for i in range(5):
        cert = Certificate(
            chain_id=31337,
            contract_address="0x5FbDB2315678afecb367f032d93F642f64180aa3",
            token_id=100 + i,
            recipient_wallet="0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
            recipient_name=f"Student {i}",
            course_title="Course",
            issue_timestamp=1700000000,
            issue_tx_hash=f"0x{'c' * 62}{i:02d}",
            issue_block_number=i + 1,
            revoked=False,
        )
        test_session.add(cert)
    await test_session.commit()

    resp = await client.get("/api/v1/certificates?page=1&page_size=2")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["results"]) == 2
    assert data["total"] == 5
    assert data["page"] == 1
    assert data["page_size"] == 2


@pytest.mark.asyncio
async def test_get_certificate_by_id(client: AsyncClient, test_session: AsyncSession):
    cert = Certificate(
        chain_id=31337,
        contract_address="0x5FbDB2315678afecb367f032d93F642f64180aa3",
        token_id=42,
        recipient_wallet="0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
        recipient_name="Charlie",
        course_title="DeFi 201",
        issue_timestamp=1700000000,
        issue_tx_hash="0x" + "d" * 64,
        issue_block_number=10,
        revoked=False,
    )
    test_session.add(cert)
    await test_session.commit()

    resp = await client.get("/api/v1/certificates/42")
    assert resp.status_code == 200
    data = resp.json()
    assert data["token_id"] == 42
    assert data["recipient_name"] == "Charlie"


@pytest.mark.asyncio
async def test_transaction_lookup(client: AsyncClient, test_session: AsyncSession):
    tx_hash = "0x" + "e" * 64
    cert = Certificate(
        chain_id=31337,
        contract_address="0x5FbDB2315678afecb367f032d93F642f64180aa3",
        token_id=7,
        recipient_wallet="0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
        recipient_name="Dave",
        course_title="NFT Art",
        issue_timestamp=1700000000,
        issue_tx_hash=tx_hash,
        issue_block_number=5,
        revoked=False,
    )
    test_session.add(cert)
    await test_session.commit()

    resp = await client.get(f"/api/v1/transactions/{tx_hash}")
    assert resp.status_code == 200
    data = resp.json()
    assert data["event_type"] == "issuance"
    assert data["token_id"] == 7


@pytest.mark.asyncio
async def test_transaction_not_found(client: AsyncClient):
    resp = await client.get("/api/v1/transactions/0x" + "f" * 64)
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_institution_lookup(client: AsyncClient, test_session: AsyncSession):
    inst = Institution(
        chain_id=31337,
        contract_address="0x5FbDB2315678afecb367f032d93F642f64180aa3",
        owner_address="0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
    )
    test_session.add(inst)
    await test_session.commit()

    resp = await client.get(
        "/api/v1/institutions/0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["owner_address"] == "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"


@pytest.mark.asyncio
async def test_institution_not_found(client: AsyncClient):
    resp = await client.get("/api/v1/institutions/0x0000000000000000000000000000000000000000")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_audit_requires_auth(client: AsyncClient):
    resp = await client.get("/api/v1/admin/audit")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_nonce_generation(client: AsyncClient):
    resp = await client.post("/api/v1/auth/nonce")
    assert resp.status_code == 200
    data = resp.json()
    assert "nonce" in data
    assert "expires_at" in data
    assert len(data["nonce"]) == 32  # 16 bytes hex


@pytest.mark.asyncio
async def test_audit_rejects_forged_token(client: AsyncClient):
    """A forged Bearer token should not grant access to admin routes."""
    resp = await client.get(
        "/api/v1/admin/audit",
        headers={"Authorization": "Bearer forged.token.here"},
    )
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_audit_rejects_header_only_auth(client: AsyncClient):
    """The old X-Wallet-Address header should no longer grant access."""
    resp = await client.get(
        "/api/v1/admin/audit",
        headers={
            "X-Wallet-Address": "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
            "Authorization": "anything",
        },
    )
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_search_revoked_filter(client: AsyncClient, test_session: AsyncSession):
    cert_valid = Certificate(
        chain_id=31337,
        contract_address="0x5FbDB2315678afecb367f032d93F642f64180aa3",
        token_id=200,
        recipient_wallet="0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
        recipient_name="Valid Cert",
        course_title="Course",
        issue_timestamp=1700000000,
        issue_tx_hash="0x" + "1" * 64,
        issue_block_number=1,
        revoked=False,
    )
    cert_revoked = Certificate(
        chain_id=31337,
        contract_address="0x5FbDB2315678afecb367f032d93F642f64180aa3",
        token_id=201,
        recipient_wallet="0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
        recipient_name="Revoked Cert",
        course_title="Course",
        issue_timestamp=1700000000,
        issue_tx_hash="0x" + "2" * 64,
        issue_block_number=2,
        revoked=True,
    )
    test_session.add_all([cert_valid, cert_revoked])
    await test_session.commit()

    resp = await client.get("/api/v1/certificates?revoked=true")
    assert resp.status_code == 200
    data = resp.json()
    assert all(r["revoked"] for r in data["results"])

    resp = await client.get("/api/v1/certificates?revoked=false")
    data = resp.json()
    assert all(not r["revoked"] for r in data["results"])
