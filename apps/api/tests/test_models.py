"""Database model tests — uniqueness, constraints, migrations."""

from __future__ import annotations

import pytest
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Certificate, IndexerCheckpoint


@pytest.mark.asyncio
async def test_certificate_uniqueness(test_session: AsyncSession):
    """Duplicate (chain_id, contract_address, token_id) must be rejected."""
    cert1 = Certificate(
        chain_id=31337,
        contract_address="0x5FbDB2315678afecb367f032d93F642f64180aa3",
        token_id=0,
        recipient_wallet="0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
        recipient_name="Alice",
        course_title="Course A",
        issue_timestamp=1700000000,
        issue_tx_hash="0x" + "a" * 64,
        issue_block_number=1,
    )
    test_session.add(cert1)
    await test_session.commit()

    cert2 = Certificate(
        chain_id=31337,
        contract_address="0x5FbDB2315678afecb367f032d93F642f64180aa3",
        token_id=0,  # Same identity
        recipient_wallet="0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
        recipient_name="Bob",
        course_title="Course B",
        issue_timestamp=1700000001,
        issue_tx_hash="0x" + "b" * 64,
        issue_block_number=2,
    )
    test_session.add(cert2)
    with pytest.raises(IntegrityError):
        await test_session.commit()
    await test_session.rollback()


@pytest.mark.asyncio
async def test_same_token_id_different_chain(test_session: AsyncSession):
    """Same token_id on different chains should be allowed."""
    cert1 = Certificate(
        chain_id=31337,
        contract_address="0x5FbDB2315678afecb367f032d93F642f64180aa3",
        token_id=0,
        recipient_wallet="0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
        recipient_name="Alice",
        course_title="Course",
        issue_timestamp=1700000000,
        issue_tx_hash="0x" + "a" * 64,
        issue_block_number=1,
    )
    cert2 = Certificate(
        chain_id=11155111,  # Sepolia — different chain
        contract_address="0x5FbDB2315678afecb367f032d93F642f64180aa3",
        token_id=0,  # Same token_id
        recipient_wallet="0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
        recipient_name="Alice",
        course_title="Course",
        issue_timestamp=1700000000,
        issue_tx_hash="0x" + "b" * 64,
        issue_block_number=1,
    )
    test_session.add_all([cert1, cert2])
    await test_session.commit()  # Should not raise

    result = await test_session.execute(select(Certificate))
    assert len(result.scalars().all()) == 2


@pytest.mark.asyncio
async def test_checkpoint_persistence(test_session: AsyncSession):
    """Checkpoints should persist and be updatable."""
    cp = IndexerCheckpoint(
        chain_id=31337,
        contract_address="0x5FbDB2315678afecb367f032d93F642f64180aa3",
        last_block=100,
    )
    test_session.add(cp)
    await test_session.commit()

    result = await test_session.execute(
        select(IndexerCheckpoint).where(IndexerCheckpoint.chain_id == 31337)
    )
    loaded = result.scalar_one()
    assert loaded.last_block == 100

    loaded.last_block = 200
    await test_session.commit()

    result = await test_session.execute(
        select(IndexerCheckpoint).where(IndexerCheckpoint.chain_id == 31337)
    )
    assert result.scalar_one().last_block == 200


@pytest.mark.asyncio
async def test_checkpoint_uniqueness(test_session: AsyncSession):
    """Duplicate (chain_id, contract_address) checkpoints must be rejected."""
    cp1 = IndexerCheckpoint(
        chain_id=31337,
        contract_address="0x5FbDB2315678afecb367f032d93F642f64180aa3",
        last_block=100,
    )
    test_session.add(cp1)
    await test_session.commit()

    cp2 = IndexerCheckpoint(
        chain_id=31337,
        contract_address="0x5FbDB2315678afecb367f032d93F642f64180aa3",
        last_block=200,
    )
    test_session.add(cp2)
    with pytest.raises(IntegrityError):
        await test_session.commit()
    await test_session.rollback()


@pytest.mark.asyncio
async def test_revocation_preserves_metadata(test_session: AsyncSession):
    """Revoking a certificate must not erase its metadata."""
    cert = Certificate(
        chain_id=31337,
        contract_address="0x5FbDB2315678afecb367f032d93F642f64180aa3",
        token_id=5,
        recipient_wallet="0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
        recipient_name="Eve",
        course_title="Security 301",
        issue_timestamp=1700000000,
        issue_tx_hash="0x" + "e" * 64,
        issue_block_number=1,
        revoked=False,
    )
    test_session.add(cert)
    await test_session.commit()

    # Revoke
    result = await test_session.execute(
        select(Certificate).where(Certificate.token_id == 5)
    )
    loaded = result.scalar_one()
    loaded.revoked = True
    loaded.revoke_tx_hash = "0x" + "f" * 64
    loaded.revoke_block_number = 10
    await test_session.commit()

    # Verify metadata is still there
    result = await test_session.execute(
        select(Certificate).where(Certificate.token_id == 5)
    )
    revoked = result.scalar_one()
    assert revoked.revoked is True
    assert revoked.recipient_name == "Eve"
    assert revoked.course_title == "Security 301"
    assert revoked.issue_timestamp == 1700000000
    assert revoked.issue_tx_hash == "0x" + "e" * 64
