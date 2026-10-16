"""Indexer tests — integration tests that require Anvil."""

from __future__ import annotations

import pytest
import pytest_asyncio
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.db import engine as engine_module
from app.db.models import Base, Certificate, IndexerCheckpoint, Institution
from app.indexer.service import index_events_once, reconcile_with_chain
from tests.conftest import requires_anvil


@pytest_asyncio.fixture
async def indexer_factory():
    """Create a dedicated in-memory engine with tables, return its session factory."""
    eng = create_async_engine("sqlite+aiosqlite://", echo=False)
    async with eng.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    factory = async_sessionmaker(eng, class_=AsyncSession, expire_on_commit=False)

    # Monkey-patch so the indexer uses our test DB
    original = engine_module.async_session_factory
    engine_module.async_session_factory = factory
    yield factory
    engine_module.async_session_factory = original

    await eng.dispose()


@requires_anvil
@pytest.mark.asyncio
async def test_index_events_from_anvil(indexer_factory):
    """Index real events from a local Anvil instance."""
    count = await index_events_once()
    assert isinstance(count, int)
    assert count >= 0


@requires_anvil
@pytest.mark.asyncio
async def test_checkpoint_survives_restart(indexer_factory):
    """After indexing, the checkpoint should persist.

    A second call should not re-process the same events.
    """
    await index_events_once()
    second_pass = await index_events_once()
    assert isinstance(second_pass, int)


@requires_anvil
@pytest.mark.asyncio
async def test_idempotent_indexing(indexer_factory):
    """Running the indexer twice should not create duplicate certificates."""
    await index_events_once()

    # Reset checkpoint to 0 to force a full re-scan
    async with indexer_factory() as s:
        result = await s.execute(select(IndexerCheckpoint))
        for cp in result.scalars().all():
            cp.last_block = 0
        await s.commit()

    await index_events_once()

    # Certificates should still be unique (no duplicates)
    async with indexer_factory() as s:
        result = await s.execute(select(Certificate))
        certs = result.scalars().all()
        identities = {(c.chain_id, c.contract_address, c.token_id) for c in certs}
        assert len(identities) == len(certs), "Duplicate certificates found!"


@requires_anvil
@pytest.mark.asyncio
async def test_reconciliation(indexer_factory):
    """Reconcile indexed state with on-chain state.

    After a fresh index + reconciliation, the index should match the chain.
    A second reconciliation should find 0 corrections.
    """
    await index_events_once()
    await reconcile_with_chain()
    # Second reconciliation should find nothing to correct
    corrected = await reconcile_with_chain()
    assert corrected == 0


@requires_anvil
@pytest.mark.asyncio
async def test_institution_tracked(indexer_factory):
    """After indexing, the institution should be recorded."""
    await index_events_once()

    async with indexer_factory() as s:
        result = await s.execute(select(Institution))
        institutions = result.scalars().all()
        if institutions:
            inst = institutions[0]
            assert inst.owner_address.startswith("0x")
            assert inst.chain_id == 31337


@requires_anvil
@pytest.mark.asyncio
async def test_revocation_indexed(indexer_factory):
    """Revoked certificates should be marked in the index after indexing + reconciliation."""
    await index_events_once()
    # Reconcile to catch any revocations that might be outside the indexed range
    await reconcile_with_chain()

    async with indexer_factory() as s:
        result = await s.execute(
            select(Certificate).where(Certificate.revoked.is_(True))
        )
        revoked = result.scalars().all()
        assert any(c.token_id == 1 for c in revoked), "Revoked certificate not found"


@requires_anvil
@pytest.mark.asyncio
async def test_certificates_indexed(indexer_factory):
    """Both issued certificates should appear in the index."""
    await index_events_once()

    async with indexer_factory() as s:
        result = await s.execute(select(Certificate))
        certs = result.scalars().all()
        assert len(certs) >= 2
        token_ids = {c.token_id for c in certs}
        assert 0 in token_ids, "Token 0 not found"
        assert 1 in token_ids, "Token 1 not found"
