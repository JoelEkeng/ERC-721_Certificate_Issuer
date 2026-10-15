# On-Chain Certificate Issuer

A full-stack platform for issuing, verifying, and managing **soulbound ERC-721 certificates** on EVM-compatible blockchains. Certificates are permanently recorded on-chain, non-transferable, publicly verifiable, revocable by the issuing institution, and represented by fully on-chain metadata and SVG images.

## Table of Contents

- [Project Overview](#project-overview)
- [Features](#features)
- [Architecture](#architecture)
- [Technology Stack](#technology-stack)
- [Repository Structure](#repository-structure)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Environment Variables](#environment-variables)
- [Local Development](#local-development)
- [Smart Contract Documentation](#smart-contract-documentation)
- [Contract Interaction Examples](#contract-interaction-examples)
- [Frontend Documentation](#frontend-documentation)
- [Backend and Database Documentation](#backend-and-database-documentation)
- [Testing](#testing)
- [Deployment](#deployment)
- [Security and Privacy](#security-and-privacy)
- [Troubleshooting](#troubleshooting)
- [API Reference](#api-reference)
- [Contribution Guide](#contribution-guide)
- [Roadmap](#roadmap)
- [License and Acknowledgements](#license-and-acknowledgements)

---

## Project Overview

The On-Chain Certificate Issuer enables an authorized institution (such as a university or training provider) to issue tamper-proof certificates of completion as ERC-721 tokens. Unlike conventional NFTs, these certificates are **soulbound** — they cannot be transferred, sold, or traded. This makes them suitable for credentialing, where provenance and non-transferability matter.

**Use cases:**
- Course completion certificates
- Professional accreditations
- Academic degrees and diplomas
- Conference attendance proofs
- Organizational membership credentials

**Core guarantees:**
- Only the authorized institution (contract owner) can issue or revoke certificates
- Each certificate has a unique, sequential token ID
- Recipient name, course title, and issuance date are stored on-chain
- Certificates cannot be transferred after minting
- Anyone can verify a certificate's authenticity by token ID
- Revoked certificates are clearly marked and never verify as valid
- All metadata and SVG images are fully on-chain — no IPFS or external dependencies

**Intended users:**
- **Institutions:** Issue and manage certificates via the dashboard with a connected wallet
- **Recipients:** Hold certificates in their wallet as non-transferable credentials
- **Public verifiers:** Check certificate authenticity on the verification page without a wallet

---

## Features

### Implemented

| Feature | Description |
|---|---|
| **ERC-721 certificate issuance** | Owner-only minting with recipient address, name, and course title |
| **Soulbound transfer restrictions** | All transfer, approval, and operator functions revert with `NonTransferable()` |
| **On-chain metadata** | `tokenURI` returns a Base64-encoded JSON with embedded SVG certificate image |
| **Three-state verification** | `verifyCertificate()` returns `Valid`, `Revoked`, or `Nonexistent` as a struct |
| **Certificate revocation** | Owner can revoke certificates; metadata is preserved for audit |
| **Input validation** | Max 128-byte names, 256-byte course titles; whitespace-only strings rejected |
| **Ownership safety** | `renounceOwnership()` is disabled to prevent accidental lockout |
| **Event indexing** | `CertificateIssued` and `CertificateRevoked` events for off-chain consumption |
| **Web dashboard** | Next.js frontend with wallet connection, issuance forms, and verification |
| **Public verification page** | `/verify/[tokenId]` with on-chain SVG display, status badges, and explorer links |
| **FastAPI backend** | Optional indexer with PostgreSQL, certificate search, and on-chain verification pass-through |
| **SIWE authentication** | Wallet-signature auth with nonce expiration, replay protection, and HMAC session tokens |
| **Event indexer** | Persistent checkpoints, reorg protection, idempotent upserts, and reconciliation |
| **78 contract tests** | Unit, fuzz (7 campaigns x 256 runs), security (26), and invariant (6 invariants, 128K calls) |
| **55 frontend tests** | Validation, error handling, explorer links, and contract utilities |
| **30 backend tests** | API, model, and Anvil integration tests |

### Future Work (Not Implemented)

- Batch certificate issuance
- Institutional multisig (Gnosis Safe) as contract owner
- EIP-5192 soulbound token interface
- Additional EVM network deployments (Polygon, Arbitrum, etc.)
- Richer verification proofs (Merkle proof of inclusion)
- Certificate templates and custom branding
- Email/webhook notification integrations
- Role-based access control beyond single owner
- Contract upgradeability via proxy pattern

---

## Architecture

```mermaid
graph TD
    subgraph Browser
        FE["Next.js Frontend<br/>wagmi + viem + RainbowKit"]
    end

    subgraph Blockchain
        SC["CertificateIssuer.sol<br/>Soulbound ERC-721"]
    end

    subgraph Backend
        API["FastAPI Backend"]
        DB["PostgreSQL / SQLite"]
        IDX["Event Indexer"]
    end

    FE -- "issue / revoke<br/>(wallet signs tx)" --> SC
    FE -- "verify / tokenURI<br/>(read-only)" --> SC
    FE -- "search / history<br/>(optional)" --> API
    API -- "on-chain verify<br/>(authoritative)" --> SC
    IDX -- "poll events<br/>(CertificateIssued,<br/>CertificateRevoked)" --> SC
    IDX -- "index" --> DB
    API -- "query" --> DB
```

**Data flow principles:**
- **Writes** (issue, revoke) are signed client-side in the user's wallet and submitted directly to the contract. The backend never holds private keys.
- **Reads** for verification query the contract directly. The `/verify` endpoint is authoritative.
- **Search** and discovery use the backend's database index, which is a searchable projection — it may lag behind chain state.
- Every API response includes a `data_source` field (`"on-chain"` or `"indexed"`) so consumers know whether data is authoritative.
- A database `revoked=false` **never** overrides a contract's revoked state.
- An unavailable RPC returns HTTP 503, never a false "valid" result.

For detailed architecture, see [docs/architecture.md](docs/architecture.md).

---

## Technology Stack

| Layer | Technology | Version |
|---|---|---|
| Smart Contracts | Solidity | 0.8.27 |
| Contract Framework | Foundry (forge, anvil, cast) | 1.8.x |
| Contract Dependencies | OpenZeppelin Contracts | 5.x |
| Frontend | Next.js (App Router) | 16.4.0 |
| Frontend Language | TypeScript (strict) | 5.x |
| Styling | Tailwind CSS | 4.x |
| Wallet Integration | RainbowKit + wagmi + viem | 2.x |
| Form Validation | React Hook Form + Zod | 7.x / 4.x |
| Frontend Testing | Vitest | 3.x |
| Backend | FastAPI | 0.115.6 |
| Backend Language | Python | 3.11+ |
| ORM | SQLAlchemy 2.x (async) | 2.0.36 |
| Migrations | Alembic | 1.14.1 |
| Database (production) | PostgreSQL (via asyncpg) | — |
| Database (development) | SQLite (via aiosqlite) | — |
| Blockchain Library | Web3.py | 7.6.0 |
| Authentication | SIWE (Sign-In with Ethereum) | 4.3.0 |
| Backend Linting | Ruff | 0.8.x |
| Backend Testing | pytest + pytest-asyncio | 8.x / 0.25.x |
| Shared Web3 Package | TypeScript (ABI, addresses, types) | — |

---

## Repository Structure

```text
capstone_project/
├── packages/
│   ├── contracts/                          # Foundry project
│   │   ├── src/CertificateIssuer.sol       # Main contract
│   │   ├── test/
│   │   │   ├── CertificateIssuer.t.sol     # Core tests (51)
│   │   │   ├── CertificateIssuerSecurity.t.sol  # Security tests (26)
│   │   │   └── CertificateIssuerInvariant.t.sol # Invariant tests (6)
│   │   ├── script/DeployCertificateIssuer.s.sol  # Deployment script
│   │   ├── foundry.toml                    # Foundry config (solc 0.8.27, optimizer)
│   │   ├── .gas-snapshot                   # Gas benchmark
│   │   └── lib/                            # Git submodules (OZ, forge-std)
│   └── web3/                               # Shared TypeScript package
│       └── src/
│           ├── abi.ts                      # Contract ABI export
│           ├── addresses.ts                # Deployed addresses by chain
│           └── types.ts                    # Shared types
├── apps/
│   ├── web/                                # Next.js frontend
│   │   ├── src/
│   │   │   ├── app/                        # Pages (landing, dashboard, verify)
│   │   │   ├── components/                 # React components
│   │   │   └── lib/                        # Web3 utilities, validation, errors
│   │   ├── src/__tests__/                  # Frontend tests (55)
│   │   ├── vitest.config.ts                # Test config
│   │   └── package.json                    # Dependencies and scripts
│   └── api/                                # FastAPI backend
│       ├── app/
│       │   ├── main.py                     # App entry point + lifespan
│       │   ├── routes.py                   # API endpoints
│       │   ├── schemas.py                  # Pydantic response models
│       │   ├── config.py                   # Settings (env-based)
│       │   ├── contract.py                 # Web3.py contract reads
│       │   ├── auth/siwe_auth.py           # SIWE authentication
│       │   ├── db/models.py                # SQLAlchemy models
│       │   ├── db/engine.py                # Async engine + session
│       │   └── indexer/service.py          # Event indexer
│       ├── alembic/                        # Database migrations
│       ├── tests/                          # Backend tests (30)
│       ├── requirements.txt                # Python dependencies
│       └── pyproject.toml                  # Ruff + pytest config
├── docs/
│   ├── architecture.md                     # System architecture
│   ├── backend.md                          # Backend operations runbook
│   ├── deployment.md                       # Deployment guide
│   └── threat-model.md                     # Security threat model
├── .env.example                            # Environment variable template
├── .gitignore
└── README.md
```

---

## Prerequisites

| Tool | Required Version | Installation |
|---|---|---|
| Git | Any recent | [git-scm.com](https://git-scm.com) |
| Foundry | Latest | `curl -L https://foundry.paradigm.xyz \| bash && foundryup` |
| Node.js | >= 18 | [nodejs.org](https://nodejs.org) |
| npm | >= 9 | Included with Node.js |
| Python | >= 3.11 | [python.org](https://python.org) |
| PostgreSQL | 14+ (production only) | [postgresql.org](https://postgresql.org) |

SQLite is used automatically for local development — PostgreSQL is only needed for production.

---

## Installation

```bash
# Clone the repository
git clone <repository-url>
cd capstone_project

# Initialize git submodules (OpenZeppelin, forge-std)
git submodule update --init --recursive

# Build smart contracts
cd packages/contracts
forge build

# Install frontend dependencies
cd ../../apps/web
npm install

# Install backend dependencies
cd ../api
python3.11 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

---

## Environment Variables

Copy `.env.example` to `.env` (backend) and `apps/web/.env.local` (frontend) and configure:

### Public Variables (safe for browser exposure)

| Variable | Required | Purpose | Example |
|---|---|---|---|
| `NEXT_PUBLIC_CONTRACT_ADDRESS` | Yes | Deployed contract address for the frontend | `0x5FbDB...aa3` |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | Yes | WalletConnect project ID | `your_project_id` |

### Server-Only Variables

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `RPC_URL` | Yes | `http://127.0.0.1:8545` | JSON-RPC endpoint |
| `CONTRACT_ADDRESS` | Yes | `0x0...0` | Deployed contract address |
| `CHAIN_ID` | Yes | `31337` | EVM chain ID |
| `DATABASE_URL` | No | `sqlite+aiosqlite:///./certificates.db` | Database connection string |
| `CORS_ORIGINS` | No | `http://localhost:3000` | Comma-separated allowed origins |
| `INDEXER_CONFIRMATION_DEPTH` | No | `1` | Blocks to wait before indexing (0 for Anvil, 12+ for mainnet) |
| `INDEXER_POLL_INTERVAL` | No | `5` | Seconds between indexer polls |
| `INDEXER_BLOCK_BATCH_SIZE` | No | `2000` | Max blocks per scan batch |
| `SIWE_DOMAIN` | No | `localhost` | Expected SIWE message domain |
| `SIWE_URI` | No | `http://localhost:3000` | Expected SIWE message URI |
| `SIWE_NONCE_TTL` | No | `300` | Nonce expiration in seconds |

### Deployment-Only Variables

| Variable | Required | Purpose |
|---|---|---|
| `EXPECTED_CHAIN_ID` | Yes | Chain-ID safety guard for deployment scripts |
| `ETHERSCAN_API_KEY` | No | Contract verification on Etherscan |

**Never commit real private keys or credentials.** The Anvil test key `0xac0974...ff80` appearing in documentation is the well-known default Anvil account — it has no value on any real network.

---

## Local Development

### 1. Start Anvil

```bash
anvil --host 127.0.0.1 --port 8545
```

This starts a local EVM node with chain ID 31337 and 10 pre-funded accounts.

### 2. Deploy the Contract

```bash
cd packages/contracts
EXPECTED_CHAIN_ID=31337 forge script script/DeployCertificateIssuer.s.sol:DeployCertificateIssuer \
  --rpc-url http://127.0.0.1:8545 \
  --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 \
  --broadcast
```

Expected output includes:
```
Contract: 0x5FbDB2315678afecb367f032d93F642f64180aa3
Owner:    0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
```

### 3. Start the Backend

```bash
cd apps/api
source venv/bin/activate
CONTRACT_ADDRESS=0x5FbDB2315678afecb367f032d93F642f64180aa3 \
  INDEXER_CONFIRMATION_DEPTH=0 \
  uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

The backend automatically creates SQLite tables and starts the event indexer. API docs are at http://127.0.0.1:8000/docs.

### 4. Start the Frontend

```bash
cd apps/web
echo "NEXT_PUBLIC_CONTRACT_ADDRESS=0x5FbDB2315678afecb367f032d93F642f64180aa3" > .env.local
echo "NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=demo" >> .env.local
npm run dev
```

Open http://localhost:3000.

### 5. Connect a Wallet

1. Import Anvil account 0 (`0xac0974...ff80`) into MetaMask
2. Add a custom network: chain ID `31337`, RPC `http://127.0.0.1:8545`
3. Navigate to `/dashboard` and connect the wallet
4. Issue a certificate, then verify it at `/verify`

---

## Smart Contract Documentation

### Contract: `CertificateIssuer`

Inherits: `ERC721` (OpenZeppelin v5), `Ownable` (OpenZeppelin v5)

Solidity: `^0.8.20` | Compiler: `0.8.27` | Optimizer: 200 runs + via-ir

### Data Structures

```solidity
enum CertificateStatus { Nonexistent, Valid, Revoked }

struct CertificateData {
    address recipient;
    string recipientName;
    string courseTitle;
    uint256 issueDate;
    bool isRevoked;
}

struct VerificationResult {
    CertificateStatus status;
    address owner;
    string recipientName;
    string courseTitle;
    uint256 issueDate;
}
```

### Functions

| Function | Visibility | Mutability | Access | Description |
|---|---|---|---|---|
| `issueCertificate(address, string, string)` | `external` | State-changing | `onlyOwner` | Mints a new soulbound certificate. Returns the token ID. |
| `getCertificate(uint256)` | `external` | `view` | Public | Returns `(owner, recipientName, courseTitle, issueDate, revoked)`. Reverts for nonexistent tokens. |
| `verifyCertificate(uint256)` | `external` | `view` | Public | Returns a `VerificationResult` struct. Does not revert for nonexistent tokens. |
| `revoke(uint256)` | `external` | State-changing | `onlyOwner` | Revokes a certificate. Preserves metadata. |
| `totalIssued()` | `external` | `view` | Public | Returns the total number of certificates issued. |
| `tokenURI(uint256)` | `public` | `view` | Public | Returns Base64-encoded JSON with embedded SVG. |

### Token ID Generation

Token IDs are sequential, starting from 0. A monotonic counter (`_nextTokenId`) ensures uniqueness. IDs are never reused, even after revocation.

### Transfer Restrictions

All five external transfer/approval entry points revert with `NonTransferable()`:

- `transferFrom(address, address, uint256)`
- `safeTransferFrom(address, address, uint256)`
- `safeTransferFrom(address, address, uint256, bytes)`
- `approve(address, uint256)`
- `setApprovalForAll(address, bool)`

### Events

```solidity
event CertificateIssued(
    uint256 indexed tokenId,
    address indexed recipient,
    string recipientName,
    string courseTitle,
    uint256 issueDate
);

event CertificateRevoked(uint256 indexed tokenId);
```

### Custom Errors

```solidity
error NonTransferable();
error CertificateNotFound(uint256 tokenId);
error AlreadyRevoked(uint256 tokenId);
error RecipientNameTooLong(uint256 length, uint256 maxLength);
error CourseTitleTooLong(uint256 length, uint256 maxLength);
error OwnershipRenunciationDisabled();
```

### Gas Considerations

- Issuance: ~170-190K gas (varies with string lengths)
- Revocation: ~55K gas
- Max string lengths (128 bytes name, 256 bytes course) limit gas costs
- Gas snapshot available in `.gas-snapshot`

---

## Contract Interaction Examples

All examples use Cast (included with Foundry) against a local Anvil node.

```bash
# Set common variables
export RPC=http://127.0.0.1:8545
export CONTRACT=0x5FbDB2315678afecb367f032d93F642f64180aa3
export OWNER_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80

# Read the contract owner
cast call $CONTRACT "owner()(address)" --rpc-url $RPC

# Issue a certificate (state-changing — requires signing)
cast send $CONTRACT "issueCertificate(address,string,string)" \
  0x70997970C51812dc3A010C7d01b50e0d17dc79C8 "Alice Johnson" "Blockchain 101" \
  --rpc-url $RPC --private-key $OWNER_KEY

# Read certificate details
cast call $CONTRACT "getCertificate(uint256)" 0 --rpc-url $RPC

# Verify a certificate (returns VerificationResult struct)
cast call $CONTRACT "verifyCertificate(uint256)" 0 --rpc-url $RPC

# Check total issued
cast call $CONTRACT "totalIssued()(uint256)" --rpc-url $RPC

# Revoke a certificate (state-changing — requires owner key)
cast send $CONTRACT "revoke(uint256)" 0 --rpc-url $RPC --private-key $OWNER_KEY

# Inspect a transaction receipt
cast receipt <TX_HASH> --rpc-url $RPC
```

**Security note:** State-changing transactions (`cast send`) require signing with the owner's private key. Never use a production private key in shell commands — use hardware wallets or multisig in production.

---

## Frontend Documentation

### Routes

| Route | Purpose | Wallet Required |
|---|---|---|
| `/` | Landing page — explains certificates, verification, and privacy | No |
| `/dashboard` | Institution dashboard — issue and revoke certificates | Yes (owner) |
| `/verify` | Search-based certificate verification | No |
| `/verify/[tokenId]` | Direct certificate verification with on-chain SVG | No |

### Components

- **Header** — Navigation with wallet connection via RainbowKit
- **IssueCertificateForm** — Validated form with preview, privacy warning, and full transaction lifecycle
- **RevokeCertificateForm** — Token ID lookup with confirmation
- **CertificateCard** — Certificate display with status badges and explorer links
- **CertificateDetailView** — Full verification page with on-chain SVG rendering

### Web3 Modules

| Module | Purpose |
|---|---|
| `lib/contracts.ts` | Contract config, status enum, label mapping |
| `lib/explorer.ts` | Chain-aware block explorer URL builders |
| `lib/errors.ts` | Contract + wallet error translation |
| `lib/validation.ts` | Zod schemas matching contract limits |
| `lib/abi.ts` | Contract ABI (imported from Foundry output) |
| `lib/config.ts` | Wagmi + RainbowKit configuration |

### Transaction Lifecycle

1. Form validates inputs with Zod schemas matching contract limits
2. Privacy warning displayed for on-chain data permanence
3. Contract call is simulated before submission (when supported)
4. Transaction is submitted via wallet signing
5. Pending transaction hash is displayed
6. Confirmation is awaited
7. Token ID is extracted from receipt event logs
8. Certificate detail page is linked

### Error States

- Wallet disconnected
- Wrong network
- Insufficient gas
- Transaction rejected by user
- Contract revert (unauthorized, invalid input)
- RPC unavailable
- Confirmation timeout

---

## Backend and Database Documentation

The backend is **optional** — the frontend reads the contract directly for all verification. The backend provides searchable indexing and historical queries.

### Database Models

| Table | Purpose | Unique Constraint |
|---|---|---|
| `certificates` | Indexed certificate records | `(chain_id, contract_address, token_id)` |
| `indexer_checkpoints` | Persistent indexer cursor | `(chain_id, contract_address)` |
| `institutions` | Known issuer addresses | `(chain_id, contract_address)` |
| `audit_logs` | Administrative audit trail | — |
| `auth_nonces` | SIWE replay protection | — |

### Indexer Architecture

The event indexer runs as a background task during the FastAPI lifespan:

1. **Poll**: Checks for new blocks every `INDEXER_POLL_INTERVAL` seconds
2. **Safe block**: Only indexes up to `current_block - INDEXER_CONFIRMATION_DEPTH`
3. **Batch scan**: Fetches events in `INDEXER_BLOCK_BATCH_SIZE` block batches
4. **Reorg protection**: Re-scans the last N confirmation-depth blocks
5. **Idempotent upserts**: Duplicate events are silently ignored
6. **Checkpoint persistence**: Last indexed block survives restarts
7. **Reconciliation**: Verifies indexed state against live contract state

### Authentication

SIWE (Sign-In with Ethereum) flow:
1. Client requests nonce: `POST /api/v1/auth/nonce`
2. Client signs SIWE message in wallet
3. Client submits: `POST /api/v1/auth/login`
4. Backend verifies nonce (atomic consumption), domain, URI, chain ID, and signature
5. Returns HMAC-signed session token
6. Token is passed as `Authorization: Bearer <token>` for protected routes

For full backend documentation, see [docs/backend.md](docs/backend.md).

---

## Testing

### Smart Contract Tests

```bash
cd packages/contracts

# Run all tests
forge test -vvv

# Run with gas reporting
forge test -vvv --gas-report

# Run specific test file
forge test --match-path test/CertificateIssuerSecurity.t.sol -vvv

# Run fuzz tests with more runs
forge test --fuzz-runs 1024

# Generate gas snapshot
forge snapshot
```

**Current results: 78 tests passed**

| Suite | Tests | Description |
|---|---|---|
| `CertificateIssuer.t.sol` | 51 | Core functionality, 7 fuzz campaigns (256 runs each) |
| `CertificateIssuerSecurity.t.sol` | 26 | Reentrancy, multi-actor auth, malicious recipients, ERC-165 |
| `CertificateIssuerInvariant.t.sol` | 6 | Stateful invariants over 256 runs / 128,000 calls |

### Frontend Tests

```bash
cd apps/web

# Run tests
npm test

# Run in watch mode
npm run test:watch
```

**Current results: 55 tests passed**

| Suite | Tests |
|---|---|
| `validation.test.ts` | 20 |
| `errors.test.ts` | 13 |
| `explorer.test.ts` | 11 |
| `contracts.test.ts` | 11 |

### Backend Tests

```bash
cd apps/api
source venv/bin/activate

# Unit tests only (no Anvil needed)
python -m pytest tests/test_api.py tests/test_models.py -v

# All tests including Anvil integration
python -m pytest tests/ -v

# With linting
ruff check app/ tests/
```

**Current results: 30 tests passed**

| Suite | Tests | Requires Anvil |
|---|---|---|
| `test_api.py` | 18 | No |
| `test_models.py` | 5 | No |
| `test_indexer.py` | 7 | Yes |

---

## Deployment

### Local (Anvil)

See [Local Development](#local-development) above.

### Testnet (Sepolia)

```bash
cd packages/contracts

# Deploy with chain-ID guard
EXPECTED_CHAIN_ID=11155111 forge script script/DeployCertificateIssuer.s.sol:DeployCertificateIssuer \
  --rpc-url $SEPOLIA_RPC_URL \
  --private-key $DEPLOYER_PRIVATE_KEY \
  --broadcast \
  --verify \
  --etherscan-api-key $ETHERSCAN_API_KEY
```

### Post-Deployment Checklist

1. Verify the deployed contract on Etherscan
2. Confirm the owner address: `cast call $CONTRACT "owner()(address)" --rpc-url $RPC`
3. Update `NEXT_PUBLIC_CONTRACT_ADDRESS` and `CONTRACT_ADDRESS`
4. Update `packages/web3/src/addresses.ts` with the new address
5. Set `INDEXER_CONFIRMATION_DEPTH` appropriately (12+ for mainnet)
6. Configure CORS origins for your production domain
7. Run Alembic migrations: `alembic upgrade head`

### Production Readiness

For production deployment, additionally:
- Use a multisig (e.g., Gnosis Safe) as the contract owner
- Use PostgreSQL: `DATABASE_URL=postgresql+asyncpg://user:pass@host/db`
- Set `SIWE_DOMAIN` and `SIWE_URI` to your production domain
- Configure rate limiting
- Run behind a reverse proxy with TLS
- Set up monitoring on the health endpoint

For detailed deployment instructions, see [docs/deployment.md](docs/deployment.md).

---

## Security and Privacy

### Security Properties

- **Soulbound enforcement:** All five transfer/approval entry points revert. No bypass exists through inherited ERC-721 functions.
- **Access control:** `onlyOwner` for issuance and revocation. Ownership transfer is single-step (`Ownable`, not `Ownable2Step`).
- **Ownership safety:** `renounceOwnership()` is disabled to prevent accidental lockout.
- **Reentrancy:** `_safeMint` calls `onERC721Received` on contract recipients, but since `issueCertificate` is `onlyOwner`, a malicious recipient cannot re-enter to issue more certificates.
- **Input validation:** String length limits prevent gas DoS. Metadata escaping prevents SVG/JSON injection.
- **Backend auth:** SIWE with atomic nonce consumption, domain/URI/chain-ID binding, and HMAC session tokens.

### Known Limitations

- **Not professionally audited.** This contract has not undergone an external security audit.
- **Single-owner model.** If the owner key is compromised, an attacker can issue and revoke freely. Use a multisig in production.
- **Single-step ownership transfer.** A typo in `transferOwnership` permanently bricks the contract. Consider `Ownable2Step` for production.
- **No upgrade path.** The contract is not upgradeable. Bugs require redeployment.
- **No batch operations.** Each issuance requires a separate transaction (~170K gas).
- **Timestamp reliance.** `block.timestamp` can be manipulated by miners (±15 seconds); acceptable for certificate dates.

### Privacy

- **On-chain data is permanently public.** Recipient names, course titles, and wallet addresses are stored on-chain and cannot be deleted.
- **Data URI metadata.** Certificate images and metadata are fully on-chain — they do not depend on external hosting but also cannot be modified.
- **Backend index.** The database stores data already public on-chain. It does not collect additional personal data.
- **A privacy warning** is displayed to issuers before submitting certificates.

For the complete threat model, see [docs/threat-model.md](docs/threat-model.md).

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `forge: command not found` | Foundry not installed | Run `curl -L https://foundry.paradigm.xyz \| bash && foundryup` |
| `Error: No matching version` | Solidity compiler mismatch | Run `foundryup` to update Foundry |
| `eth_chainId` connection refused | Anvil not running | Start Anvil: `anvil --host 127.0.0.1 --port 8545` |
| Deployment aborts with chain-ID error | `EXPECTED_CHAIN_ID` doesn't match | Set `EXPECTED_CHAIN_ID` to match the target network |
| `Missing contract address` | `CONTRACT_ADDRESS` not set | Set the env var or update `.env` |
| Transaction rejected by user | User declined in wallet | Normal — retry the action |
| `Gas estimation failed` | Transaction would revert | Check: correct network? authorized wallet? valid inputs? |
| `execution reverted: OwnableUnauthorizedAccount` | Wrong wallet or non-owner | Connect the owner wallet (deployer account) |
| `execution reverted: NonTransferable` | Attempted transfer of soulbound token | Expected — certificates cannot be transferred |
| Backend `rpc_connected: false` | RPC node down or misconfigured | Check `RPC_URL` and node status |
| Backend `database_connected: false` | Database connection failed | Check `DATABASE_URL` and credentials |
| `no such table` | Missing migrations | Run `alembic upgrade head` or let the app auto-create tables |
| Certificate not found in index | Not yet indexed | Wait for the indexer or use `/verify` for on-chain lookup |
| Verify returns 503 | RPC unavailable | This is correct — does NOT mean the certificate is invalid |
| `abnf` import error | SIWE dependency conflict | Ensure `abnf==2.3.0` is pinned in requirements.txt |
| `Contract artifact not found` | Forge artifacts missing | Run `forge build` in `packages/contracts/` |

---

## API Reference

Base URL: `http://localhost:8000/api/v1`

Interactive docs: `http://localhost:8000/docs`

### Public Endpoints

#### `GET /api/v1/health`

Health and status check.

```json
{
  "status": "ok",
  "chain_id": 31337,
  "contract_address": "0x5FbDB...aa3",
  "rpc_connected": true,
  "database_connected": true,
  "indexer_block": 4
}
```

Status is `"ok"` when both RPC and DB are connected, `"degraded"` otherwise.

#### `GET /api/v1/certificates/{token_id}`

Look up an indexed certificate.

- **200:** Certificate found (data_source: `"indexed"`)
- **404:** Not found in index

#### `GET /api/v1/certificates`

Search indexed certificates.

| Parameter | Type | Description |
|---|---|---|
| `q` | string | Search in name/course |
| `recipient` | string | Filter by wallet address |
| `revoked` | boolean | Filter by revocation status |
| `chain_id` | integer | Filter by chain ID |
| `page` | integer | Page number (default 1) |
| `page_size` | integer | Results per page (1-100, default 20) |

Response:
```json
{
  "results": [...],
  "total": 2,
  "page": 1,
  "page_size": 20
}
```

#### `GET /api/v1/certificates/{token_id}/verify`

**Authoritative** on-chain verification.

- **200:** Returns verification result with `data_source: "on-chain"`
- **503:** RPC unavailable (does NOT mean the certificate is invalid)

```json
{
  "token_id": 0,
  "status": "valid",
  "valid": true,
  "recipient_name": "Alice Johnson",
  "course_title": "Blockchain Fundamentals",
  "issue_date": 1700000000,
  "owner": "0x7099...79C8",
  "revoked": false,
  "data_source": "on-chain"
}
```

#### `GET /api/v1/institutions/{address}`

Look up an indexed institution.

#### `GET /api/v1/transactions/{tx_hash}`

Look up an indexed transaction.

### Authentication Endpoints

#### `POST /api/v1/auth/nonce`

Generate a SIWE nonce.

```json
{ "nonce": "a1b2c3...", "expires_at": "2024-01-01T00:05:00" }
```

#### `POST /api/v1/auth/login`

Verify a SIWE signature and receive a session token.

Request:
```json
{ "message": "<SIWE message string>", "signature": "0x..." }
```

Response:
```json
{
  "address": "0xf39F...2266",
  "chain_id": 31337,
  "authenticated": true,
  "session_token": "<HMAC-signed token>"
}
```

### Protected Endpoints

#### `GET /api/v1/admin/audit`

Fetch audit logs. Requires `Authorization: Bearer <session_token>`.

- **200:** List of audit log entries
- **401:** Authentication required

---

## Contribution Guide

### Branching

- Create feature branches from `main`
- Use descriptive branch names (e.g., `add-batch-issuance`)

### Code Style

- **Solidity:** Follow `forge fmt` formatting. Run `forge fmt --check` before committing.
- **TypeScript:** Follow ESLint + Prettier via `npm run lint`
- **Python:** Follow Ruff rules. Run `ruff check app/ tests/` before committing.

### Testing Expectations

- New contract features must include unit tests and, where appropriate, fuzz tests
- New frontend features must include Vitest tests
- New API endpoints must include test cases in `test_api.py`
- All tests must pass before merging

### Pull Request Requirements

1. All quality gates pass (forge test, npm test, pytest, lint)
2. No new security warnings introduced
3. Documentation updated if behavior changes
4. Commit messages describe the "why", not just the "what"

### Adding a New Feature

1. Start with the smart contract (if applicable) — write failing tests first
2. Build the frontend integration
3. Add backend indexing support if the feature generates new events
4. Update documentation

### Dependency Updates

- Pin specific versions in `requirements.txt` and `package.json`
- Test thoroughly after any dependency update
- Prefer versions published at least 7 days ago

---

## Roadmap

These items are **not implemented** and represent potential future enhancements:

- [ ] **Batch issuance** — issue multiple certificates in a single transaction
- [ ] **Institutional multisig** — Gnosis Safe as contract owner for production
- [ ] **Ownable2Step** — two-step ownership transfer to prevent accidental lockout
- [ ] **EIP-5192** — implement the soulbound token standard interface
- [ ] **Additional networks** — Polygon, Arbitrum, Base, Optimism support
- [ ] **Role-based access** — multiple authorized issuers per institution
- [ ] **Certificate templates** — custom branding and layouts for SVG output
- [ ] **Notification integrations** — email/webhook on issuance and revocation
- [ ] **Contract upgradeability** — UUPS or transparent proxy for bug fixes
- [ ] **Batch verification** — verify multiple certificates in one call
- [ ] **Export/print** — downloadable PDF certificate (with on-chain verification link)
- [ ] **Rate limiting middleware** — enforce `RATE_LIMIT_PER_MINUTE` via slowapi or similar
- [ ] **Nonce cleanup** — periodic purge of expired `auth_nonce` rows

---

## License and Acknowledgements

### License

MIT

### Acknowledgements

- [OpenZeppelin Contracts](https://github.com/OpenZeppelin/openzeppelin-contracts) — ERC-721 and Ownable implementations (MIT)
- [Foundry](https://github.com/foundry-rs/foundry) — Solidity development framework (MIT/Apache-2.0)
- [Next.js](https://nextjs.org) — React framework
- [RainbowKit](https://www.rainbowkit.com) — Wallet connection UI
- [wagmi](https://wagmi.sh) / [viem](https://viem.sh) — Ethereum TypeScript libraries
- [FastAPI](https://fastapi.tiangolo.com) — Python web framework
- [SQLAlchemy](https://www.sqlalchemy.org) — Python ORM
- [SIWE](https://login.xyz) — Sign-In with Ethereum standard
