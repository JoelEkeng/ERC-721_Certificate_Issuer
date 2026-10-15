"""Shared test fixtures for the API test suite.

Uses an in-memory SQLite database and optional Anvil for integration tests.
"""

from __future__ import annotations

import asyncio
import os
from collections.abc import AsyncGenerator

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

# Override settings BEFORE importing app modules
os.environ["DATABASE_URL"] = "sqlite+aiosqlite://"  # In-memory
os.environ["CONTRACT_ADDRESS"] = "0x5FbDB2315678afecb367f032d93F642f64180aa3"
os.environ["CHAIN_ID"] = "31337"
os.environ["RPC_URL"] = "http://127.0.0.1:8545"
os.environ["INDEXER_CONFIRMATION_DEPTH"] = "0"  # Anvil has instant finality

from app.db import engine as engine_module  # noqa: E402
from app.db.models import Base  # noqa: E402
from app.main import app  # noqa: E402


@pytest.fixture(scope="session")
def event_loop():
    """Create a single event loop for the entire test session."""
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest_asyncio.fixture
async def test_engine():
    """Create a fresh in-memory SQLite engine for each test."""
    eng = create_async_engine("sqlite+aiosqlite://", echo=False)
    async with eng.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield eng
    await eng.dispose()


@pytest_asyncio.fixture
async def test_session(test_engine) -> AsyncGenerator[AsyncSession, None]:
    """Provide a test database session."""
    factory = async_sessionmaker(
        test_engine, class_=AsyncSession, expire_on_commit=False
    )
    async with factory() as session:
        yield session


@pytest_asyncio.fixture
async def client(test_engine) -> AsyncGenerator[AsyncClient, None]:
    """Provide an async HTTP client bound to the test app with test DB."""
    factory = async_sessionmaker(
        test_engine, class_=AsyncSession, expire_on_commit=False
    )

    async def override_get_session():
        async with factory() as session:
            yield session

    # Override the DB dependency
    from app.db.engine import get_session
    app.dependency_overrides[get_session] = override_get_session

    # Also monkey-patch the session factory used by the indexer
    original_factory = engine_module.async_session_factory
    engine_module.async_session_factory = factory

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

    app.dependency_overrides.clear()
    engine_module.async_session_factory = original_factory


def is_anvil_running() -> bool:
    """Check if a local Anvil instance is available."""
    try:
        from web3 import Web3
        w3 = Web3(Web3.HTTPProvider("http://127.0.0.1:8545"))
        return w3.is_connected()
    except Exception:
        return False


requires_anvil = pytest.mark.skipif(
    not is_anvil_running(),
    reason="Anvil not running on localhost:8545",
)
