# Backend API and Event Indexer

## Overview

The backend is an **optional complement** to the smart contract. It provides:

- Searchable certificate index (faster than scanning chain history)
- Event indexing with persistent checkpoints
- On-chain verification pass-through
- Institution profile tracking
- SIWE-based authentication for administrative routes
- Audit logging

**The backend never holds private keys and never signs transactions.** All write operations (issue, revoke) are performed client-side via wallet signing.

**The smart contract is always authoritative.** The database index is a searchable projection that may lag behind chain state. All verification responses include a `data_source` field (`"on-chain"` or `"indexed"`) so consumers know whether the data is authoritative.

## Architecture

```
Frontend (Next.js)
    |
    ├─> Smart Contract (via Wagmi/Viem) ─── issue, revoke, verify
    |
    └─> Backend API (FastAPI) ─── search, discovery, history
            |
            ├─> Database (PostgreSQL/SQLite)
            |
            └─> RPC Node ─── event indexing, on-chain verification
```

## Stack

| Component | Technology |
|---|---|
| Framework | FastAPI 0.115.6 |
| Database ORM | SQLAlchemy 2.0.36 (async) |
| Migrations | Alembic 1.14.1 |
| Production DB | PostgreSQL (via asyncpg) |
| Development DB | SQLite (via aiosqlite) |
| Blockchain | Web3.py 7.6.0 |
| Auth | SIWE (siwe 4.3.0) |
| Validation | Pydantic 2.10.4 |
| Python | 3.11+ |

## Data Model

### certificates

Primary indexed record. Unique on `(chain_id, contract_address, token_id)`.

| Column | Type | Description |
|---|---|---|
| chain_id | INTEGER | EVM chain ID |
| contract_address | VARCHAR(42) | Contract address |
| token_id | BIGINT | Certificate token ID |
| recipient_wallet | VARCHAR(42) | Recipient address |
| recipient_name | VARCHAR(256) | Recipient name |
| course_title | VARCHAR(512) | Course title |
| issue_timestamp | BIGINT | On-chain issuance timestamp |
| issue_tx_hash | VARCHAR(66) | Issuance transaction hash |
| issue_block_number | BIGINT | Block number of issuance |
| revoked | BOOLEAN | Revocation state |
| revoke_tx_hash | VARCHAR(66) | Revocation transaction hash |
| revoke_block_number | BIGINT | Block number of revocation |
| last_synced_at | TIMESTAMP | Last synchronization time |

### indexer_checkpoints

Persistent cursor for the event indexer. One row per chain+contract.

### institutions

Tracks known issuer addresses and contract ownership.

### audit_logs

Administrative audit trail for backend actions (indexer syncs, reconciliations, auth events).

### auth_nonces

SIWE nonce store for replay protection.

## Event Indexer

### How It Works

1. **Poll loop**: Every `INDEXER_POLL_INTERVAL` seconds, the indexer checks for new blocks.
2. **Safe block**: Only indexes up to `current_block - INDEXER_CONFIRMATION_DEPTH` to avoid indexing blocks that may be reorganized.
3. **Batch scanning**: Fetches events in batches of `INDEXER_BLOCK_BATCH_SIZE` blocks to avoid RPC limits.
4. **Reorg protection**: On each pass, re-scans the last N blocks (where N = confirmation depth) to catch any reorganizations.
5. **Idempotent**: Duplicate events are detected by certificate identity `(chain_id, contract_address, token_id)` and silently ignored.
6. **Persistent checkpoint**: The last indexed block is stored in the database and survives restarts.
7. **Reconciliation**: A separate reconciliation function can verify indexed records against current contract state and correct any discrepancies.

### Finality Assumptions

| Chain | Confirmation Depth | Rationale |
|---|---|---|
| Anvil/Hardhat (31337) | 0 | Instant finality, no reorgs |
| Sepolia (11155111) | 1-2 | Fast finality on testnets |
| Ethereum mainnet (1) | 12+ | ~3 minutes, covers most reorgs |

### Error Handling

- **RPC failures**: Bounded exponential backoff (`INDEXER_BACKOFF_BASE ^ retries`, capped at 60s).
- **Max retries**: After `INDEXER_MAX_RETRIES` consecutive failures, the indexer stops.
- **Partial scans**: If a batch fails mid-scan, the checkpoint is not advanced past the failed range.
- **Missing certificates**: If a revocation event arrives for an unindexed certificate, it is logged and the reconciliation pass will fix it.

## API Endpoints

### Public (no auth required)

| Method | Path | Description |
|---|---|---|
| GET | `/` | API info |
| GET | `/api/v1/health` | Health, RPC status, DB status, indexer block |
| GET | `/api/v1/certificates/{token_id}` | Indexed certificate lookup |
| GET | `/api/v1/certificates` | Search with `q`, `recipient`, `revoked`, pagination |
| GET | `/api/v1/certificates/{token_id}/verify` | **Authoritative** on-chain verification |
| GET | `/api/v1/institutions/{address}` | Institution profile |
| GET | `/api/v1/transactions/{tx_hash}` | Transaction lookup |
| POST | `/api/v1/auth/nonce` | Get a SIWE nonce |
| POST | `/api/v1/auth/login` | Verify SIWE signature |

### Protected (auth required)

| Method | Path | Description |
|---|---|---|
| GET | `/api/v1/admin/audit` | Audit logs |

### Verification

The `/verify` endpoint reads directly from the contract and returns `data_source: "on-chain"`. This is the only trustworthy verification source.

The `/certificates/{token_id}` endpoint returns indexed data with `data_source: "indexed"`. This data may be stale. A database `revoked=false` **never** overrides a contract's revoked state.

If the RPC is unavailable, the verify endpoint returns HTTP 503 with a clear message that this does NOT mean the certificate is invalid.

## Authentication

### SIWE Flow

1. Client requests a nonce: `POST /api/v1/auth/nonce`
2. Client constructs and signs a SIWE message in the wallet
3. Client sends the message and signature: `POST /api/v1/auth/login`
4. Backend verifies: nonce validity, expiration, domain, signature
5. On success, returns the authenticated address

### Security Properties

- **Nonce expiration**: Nonces expire after `SIWE_NONCE_TTL` seconds (default 300).
- **Replay protection**: Each nonce can only be used once.
- **Domain binding**: The SIWE domain must match `SIWE_DOMAIN`.
- **Signature verification**: The `siwe` library verifies EIP-4361 signatures.
- **No address trust**: An address in an HTTP header is never trusted without a verified SIWE session.

### Relationship to Contract Authority

- Backend auth gates **administrative API routes only** (audit logs, future admin features).
- Contract permissions (`onlyOwner` for issue/revoke) are enforced **on-chain**.
- A valid SIWE session does not grant contract permissions.
- Backend roles should be documented relative to the institution's on-chain authority.

## Database Security and Privacy

- **Environment-based credentials**: Database URL is configured via `DATABASE_URL` env var. Never hardcode credentials.
- **Least privilege**: The database user should only have access to the certificate database.
- **Alembic migrations**: Schema changes are versioned and applied via Alembic.
- **Safe logging**: No secrets or private keys are logged.
- **Input validation**: All inputs are validated via Pydantic schemas and SQLAlchemy parameterized queries.
- **CORS**: Restricted to configured origins only.

### Privacy Considerations

- **On-chain data is public**: Recipient names, course titles, and wallet addresses published to the blockchain cannot be reliably deleted.
- **Minimal duplication**: The index stores data already public on-chain. It does not collect additional personal data.
- **Retention**: Index data should be retained as long as the corresponding on-chain data exists. For off-chain administrative data (audit logs, auth nonces), define a retention policy appropriate to your jurisdiction.

## Operational Runbook

### Local Development

```bash
cd apps/api

# Create virtual environment
python3.11 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Start Anvil
anvil --host 127.0.0.1 --port 8545 &

# Deploy contract
cd ../../packages/contracts
EXPECTED_CHAIN_ID=31337 forge script script/DeployCertificateIssuer.s.sol:DeployCertificateIssuer \
  --rpc-url http://127.0.0.1:8545 \
  --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 \
  --broadcast
cd ../../apps/api

# Configure
export CONTRACT_ADDRESS=0x5FbDB2315678afecb367f032d93F642f64180aa3
export INDEXER_CONFIRMATION_DEPTH=0  # Anvil has instant finality

# Run API (auto-creates SQLite DB and starts indexer)
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000

# In another terminal, check health
curl http://127.0.0.1:8000/api/v1/health
```

### Running Migrations

```bash
cd apps/api
source venv/bin/activate

# Run migrations
alembic upgrade head

# Generate a new migration after model changes
alembic revision --autogenerate -m "description"
```

### Running Tests

```bash
cd apps/api
source venv/bin/activate

# Unit tests only (no Anvil needed)
python -m pytest tests/test_api.py tests/test_models.py -v

# All tests including integration (requires Anvil + deployed contract)
python -m pytest tests/ -v

# With coverage
python -m pytest tests/ -v --tb=short
```

### Linting

```bash
cd apps/api
source venv/bin/activate

# Check
ruff check app/ tests/

# Auto-fix
ruff check app/ tests/ --fix
```

### Production Deployment

1. Use PostgreSQL: `DATABASE_URL=postgresql+asyncpg://user:pass@host/certificates`
2. Set `INDEXER_CONFIRMATION_DEPTH >= 12` for mainnet
3. Set `CORS_ORIGINS` to your production frontend domain only
4. Set `SIWE_DOMAIN` and `SIWE_URI` to your production domain
5. Run migrations: `alembic upgrade head`
6. Start with a process manager: `gunicorn app.main:app -k uvicorn.workers.UvicornWorker`
7. Monitor the health endpoint and indexer logs

### Monitoring

- **Health endpoint**: `GET /api/v1/health` returns RPC status, DB status, and last indexed block.
- **Indexer logs**: Watch for `Indexed N new events` (normal) vs `Indexer error` (needs attention).
- **Reconciliation**: Periodically run reconciliation to catch any drift between index and chain state.

### Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Health shows `rpc_connected: false` | RPC node down or misconfigured | Check `RPC_URL` and node status |
| Health shows `database_connected: false` | Database connection failed | Check `DATABASE_URL` and credentials |
| Indexer stops after max retries | Persistent RPC failure | Fix RPC, restart API |
| Certificates missing from index | Not yet indexed | Wait for indexer or trigger manual reconciliation |
| Revocation not reflected in index | Confirmation depth | Wait or reduce `INDEXER_CONFIRMATION_DEPTH` |
| 503 on verify endpoint | RPC unavailable | This is correct behavior; does NOT mean cert is invalid |
