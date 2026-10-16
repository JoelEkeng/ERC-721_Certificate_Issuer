"""Certificate event indexer with persistent checkpoints and reorg handling.

Architecture:
- Polls the blockchain for CertificateIssued and CertificateRevoked events.
- Stores indexed data in PostgreSQL/SQLite as a searchable projection.
- Uses persistent checkpoints to survive restarts without re-scanning.
- Handles chain reorganizations by re-scanning recent blocks.
- Idempotent: duplicate events are ignored via upsert logic.
- The index is NEVER authoritative — contract reads verify actual state.

Finality assumptions:
- Anvil/Hardhat (chain 31337): instant finality, 1-block confirmation depth.
- Sepolia/testnets: ~2 epochs (~12.8 min) for finality; we use a configurable
  confirmation depth (default 1) as a practical compromise.
- For production on mainnet, set INDEXER_CONFIRMATION_DEPTH >= 12.
"""

from __future__ import annotations

import asyncio
import datetime
import json
import logging
from pathlib import Path
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db import engine as _engine_module
from app.db.models import AuditLog, Certificate, IndexerCheckpoint, Institution

logger = logging.getLogger(__name__)

# Bundled ABI (works in Docker / deployed environments)
_BUNDLED_ABI_PATH = Path(__file__).resolve().parent.parent / "abi.json"
# Foundry build artifact (used in local development)
_FOUNDRY_ABI_PATH = (
    Path(__file__).resolve().parents[4]
    / "packages"
    / "contracts"
    / "out"
    / "CertificateIssuer.sol"
    / "CertificateIssuer.json"
)


def _load_abi() -> list[dict[str, Any]]:
    """Load the contract ABI. Prefers bundled abi.json, falls back to Foundry output."""
    if _BUNDLED_ABI_PATH.exists():
        with open(_BUNDLED_ABI_PATH) as f:
            return json.load(f)
    if _FOUNDRY_ABI_PATH.exists():
        with open(_FOUNDRY_ABI_PATH) as f:
            artifact = json.load(f)
        return artifact["abi"]
    raise FileNotFoundError(
        f"Contract ABI not found at {_BUNDLED_ABI_PATH} or {_FOUNDRY_ABI_PATH}. "
        "Run `forge build` in packages/contracts/ or copy abi.json to apps/api/app/."
    )


def _get_web3():
    """Create a synchronous Web3 instance for the indexer."""
    from web3 import Web3

    return Web3(Web3.HTTPProvider(settings.rpc_url))


async def _get_or_create_checkpoint(
    session: AsyncSession,
    chain_id: int,
    contract_address: str,
) -> int:
    """Return the last indexed block, creating the checkpoint if needed."""
    result = await session.execute(
        select(IndexerCheckpoint).where(
            IndexerCheckpoint.chain_id == chain_id,
            IndexerCheckpoint.contract_address == contract_address,
        )
    )
    checkpoint = result.scalar_one_or_none()
    if checkpoint is None:
        checkpoint = IndexerCheckpoint(
            chain_id=chain_id,
            contract_address=contract_address,
            last_block=0,
        )
        session.add(checkpoint)
        await session.flush()
    return checkpoint.last_block


async def _update_checkpoint(
    session: AsyncSession,
    chain_id: int,
    contract_address: str,
    block_number: int,
) -> None:
    """Update the persistent checkpoint to the given block number."""
    result = await session.execute(
        select(IndexerCheckpoint).where(
            IndexerCheckpoint.chain_id == chain_id,
            IndexerCheckpoint.contract_address == contract_address,
        )
    )
    checkpoint = result.scalar_one()
    checkpoint.last_block = block_number
    checkpoint.updated_at = datetime.datetime.now(datetime.UTC)


async def _upsert_certificate(
    session: AsyncSession,
    chain_id: int,
    contract_address: str,
    token_id: int,
    recipient_wallet: str,
    recipient_name: str,
    course_title: str,
    issue_timestamp: int,
    issue_tx_hash: str,
    issue_block_number: int,
) -> None:
    """Insert or ignore a certificate (idempotent)."""
    existing = await session.execute(
        select(Certificate).where(
            Certificate.chain_id == chain_id,
            Certificate.contract_address == contract_address,
            Certificate.token_id == token_id,
        )
    )
    if existing.scalar_one_or_none() is not None:
        return  # Already indexed — skip duplicate

    cert = Certificate(
        chain_id=chain_id,
        contract_address=contract_address,
        token_id=token_id,
        recipient_wallet=recipient_wallet,
        recipient_name=recipient_name,
        course_title=course_title,
        issue_timestamp=issue_timestamp,
        issue_tx_hash=issue_tx_hash,
        issue_block_number=issue_block_number,
        revoked=False,
    )
    session.add(cert)


async def _apply_revocation(
    session: AsyncSession,
    chain_id: int,
    contract_address: str,
    token_id: int,
    tx_hash: str,
    block_number: int,
) -> None:
    """Mark a certificate as revoked (idempotent)."""
    result = await session.execute(
        select(Certificate).where(
            Certificate.chain_id == chain_id,
            Certificate.contract_address == contract_address,
            Certificate.token_id == token_id,
        )
    )
    cert = result.scalar_one_or_none()
    if cert is None:
        logger.warning("Revocation for unknown token %d — will reconcile later", token_id)
        return
    if cert.revoked:
        return  # Already marked

    cert.revoked = True
    cert.revoke_tx_hash = tx_hash
    cert.revoke_block_number = block_number
    cert.last_synced_at = datetime.datetime.now(datetime.UTC)


async def _update_institution(
    session: AsyncSession,
    chain_id: int,
    contract_address: str,
    owner_address: str,
) -> None:
    """Create or update the institution record for this contract."""
    result = await session.execute(
        select(Institution).where(
            Institution.chain_id == chain_id,
            Institution.contract_address == contract_address,
        )
    )
    inst = result.scalar_one_or_none()
    if inst is None:
        inst = Institution(
            chain_id=chain_id,
            contract_address=contract_address,
            owner_address=owner_address,
        )
        session.add(inst)
    elif inst.owner_address != owner_address:
        inst.owner_address = owner_address
        inst.last_verified_at = datetime.datetime.now(datetime.UTC)


async def _write_audit(
    session: AsyncSession,
    action: str,
    detail: str | None = None,
    actor: str | None = None,
    chain_id: int | None = None,
    contract_address: str | None = None,
    token_id: int | None = None,
) -> None:
    session.add(
        AuditLog(
            action=action,
            actor=actor,
            detail=detail,
            chain_id=chain_id,
            contract_address=contract_address,
            token_id=token_id,
        )
    )


async def index_events_once() -> int:
    """Run one indexing pass. Returns the number of new events processed.

    This is the core function called by the polling loop and by tests.
    """
    w3 = _get_web3()

    if not w3.is_connected():
        logger.warning("RPC not connected — skipping indexing pass")
        return 0

    chain_id = settings.chain_id
    contract_address = w3.to_checksum_address(settings.contract_address)

    abi = _load_abi()
    contract = w3.eth.contract(address=contract_address, abi=abi)

    current_block = w3.eth.block_number
    safe_block = max(0, current_block - settings.indexer_confirmation_depth)

    if safe_block == 0:
        return 0

    async with _engine_module.async_session_factory() as session:
        last_block = await _get_or_create_checkpoint(session, chain_id, contract_address)

        # For reorg protection, re-scan the last N confirmation-depth blocks
        from_block = max(0, last_block - settings.indexer_confirmation_depth)

        if from_block >= safe_block:
            await session.commit()
            return 0

        events_processed = 0
        batch_size = settings.indexer_block_batch_size
        scan_start = from_block

        while scan_start < safe_block:
            scan_end = min(scan_start + batch_size - 1, safe_block)

            # Fetch issuance events
            try:
                issued_logs = contract.events.CertificateIssued.get_logs(
                    from_block=scan_start, to_block=scan_end
                )
            except Exception as exc:
                logger.error("Failed to fetch issuance events [%d-%d]: %s", scan_start, scan_end, exc)
                break

            for log in issued_logs:
                await _upsert_certificate(
                    session=session,
                    chain_id=chain_id,
                    contract_address=contract_address,
                    token_id=log.args.tokenId,
                    recipient_wallet=log.args.recipient,
                    recipient_name=log.args.recipientName,
                    course_title=log.args.courseTitle,
                    issue_timestamp=log.args.issueDate,
                    issue_tx_hash="0x" + log.transactionHash.hex(),
                    issue_block_number=log.blockNumber,
                )
                events_processed += 1

            # Fetch revocation events
            try:
                revoked_logs = contract.events.CertificateRevoked.get_logs(
                    from_block=scan_start, to_block=scan_end
                )
            except Exception as exc:
                logger.error("Failed to fetch revocation events [%d-%d]: %s", scan_start, scan_end, exc)
                break

            for log in revoked_logs:
                await _apply_revocation(
                    session=session,
                    chain_id=chain_id,
                    contract_address=contract_address,
                    token_id=log.args.tokenId,
                    tx_hash="0x" + log.transactionHash.hex(),
                    block_number=log.blockNumber,
                )
                events_processed += 1

            scan_start = scan_end + 1

        # Update checkpoint
        await _update_checkpoint(session, chain_id, contract_address, safe_block)

        # Update institution owner
        try:
            owner = contract.functions.owner().call()
            await _update_institution(session, chain_id, contract_address, owner)
        except Exception as exc:
            logger.warning("Could not read contract owner: %s", exc)

        if events_processed > 0:
            await _write_audit(
                session,
                action="indexer_sync",
                detail=f"Indexed {events_processed} events up to block {safe_block}",
                chain_id=chain_id,
                contract_address=contract_address,
            )

        await session.commit()

    return events_processed


async def reconcile_with_chain(token_ids: list[int] | None = None) -> int:
    """Reconcile indexed records against actual contract state.

    If token_ids is None, reconciles all indexed certificates.
    Returns the number of records corrected.
    """
    w3 = _get_web3()
    if not w3.is_connected():
        logger.warning("RPC not connected — skipping reconciliation")
        return 0

    chain_id = settings.chain_id
    contract_address = w3.to_checksum_address(settings.contract_address)
    abi = _load_abi()
    contract = w3.eth.contract(address=contract_address, abi=abi)
    corrected = 0

    async with _engine_module.async_session_factory() as session:
        query = select(Certificate).where(
            Certificate.chain_id == chain_id,
            Certificate.contract_address == contract_address,
        )
        if token_ids is not None:
            query = query.where(Certificate.token_id.in_(token_ids))

        result = await session.execute(query)
        certs = result.scalars().all()

        for cert in certs:
            try:
                # verifyCertificate returns (status, owner, name, course, date)
                verify_result = contract.functions.verifyCertificate(cert.token_id).call()
                on_chain_status = verify_result[0]  # 0=nonexistent, 1=valid, 2=revoked
                on_chain_revoked = on_chain_status == 2

                if cert.revoked != on_chain_revoked:
                    cert.revoked = on_chain_revoked
                    cert.last_synced_at = datetime.datetime.now(datetime.UTC)
                    corrected += 1
                    logger.info(
                        "Reconciled token %d: revoked=%s", cert.token_id, on_chain_revoked
                    )
            except Exception as exc:
                logger.warning("Reconciliation failed for token %d: %s", cert.token_id, exc)

        if corrected > 0:
            await _write_audit(
                session,
                action="reconciliation",
                detail=f"Corrected {corrected} records",
                chain_id=chain_id,
                contract_address=contract_address,
            )

        await session.commit()

    return corrected


_NONCE_CLEANUP_INTERVAL = 60  # Run nonce cleanup every 60 index passes (~5 min at 5s interval)


async def run_indexer_loop() -> None:
    """Background loop that polls for new events."""
    from app.auth.siwe_auth import cleanup_expired_nonces  # avoid circular import

    logger.info(
        "Starting indexer — chain=%d contract=%s interval=%ds",
        settings.chain_id,
        settings.contract_address,
        settings.indexer_poll_interval,
    )
    retries = 0
    loop_count = 0

    while True:
        try:
            count = await index_events_once()
            if count > 0:
                logger.info("Indexed %d new events", count)

            # Periodic nonce cleanup
            loop_count += 1
            if loop_count % _NONCE_CLEANUP_INTERVAL == 0:
                async with _engine_module.async_session_factory() as session:
                    cleaned = await cleanup_expired_nonces(session)
                    if cleaned > 0:
                        logger.info("Cleaned up %d expired nonces", cleaned)

            retries = 0  # Reset on success
        except Exception as exc:
            retries += 1
            backoff = min(
                settings.indexer_backoff_base ** retries,
                60,
            )
            logger.error(
                "Indexer error (retry %d/%d, backoff %.1fs): %s",
                retries,
                settings.indexer_max_retries,
                backoff,
                exc,
            )
            if retries >= settings.indexer_max_retries:
                logger.critical("Indexer exceeded max retries — stopping")
                return
            await asyncio.sleep(backoff)
            continue

        await asyncio.sleep(settings.indexer_poll_interval)
