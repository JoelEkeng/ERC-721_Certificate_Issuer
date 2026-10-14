# Architecture

## Overview

The On-Chain Certificate Issuer is a three-tier application:

1. **Smart Contract Layer** (`packages/contracts/`) — Solidity ERC-721 contract deployed to EVM-compatible chains.
2. **Backend API** (`apps/api/`) — Python FastAPI service providing read-only REST endpoints for certificate data.
3. **Frontend** (`apps/web/`) — Next.js application with RainbowKit wallet integration for issuing, revoking, and verifying certificates.

A shared TypeScript package (`packages/web3/`) holds the contract ABI, deployment addresses, and type definitions consumed by both the frontend and (if needed) any TypeScript tooling.

## Data Flow

```
┌─────────────┐      write (wallet tx)      ┌──────────────────┐
│  Frontend    │ ──────────────────────────► │  Smart Contract  │
│  (Next.js)   │                             │  (ERC-721)       │
│              │ ◄────────── read (viem) ──── │                  │
└──────┬───────┘                             └────────┬─────────┘
       │                                              │
       │  REST read                                   │ events / state
       ▼                                              ▼
┌─────────────┐      read (web3.py)         ┌──────────────────┐
│  Backend API │ ◄───────────────────────── │   RPC Node       │
│  (FastAPI)   │                             │ (Anvil / Infura) │
└─────────────┘                             └──────────────────┘
```

### Write path (issue / revoke)

1. Institution connects wallet in the frontend.
2. Frontend calls `writeContract()` via wagmi — the transaction is signed client-side.
3. The wallet broadcasts the transaction to the RPC node.
4. The contract emits `CertificateIssued` or `CertificateRevoked` events.
5. The frontend waits for the transaction receipt before confirming success.

**Security decision:** The backend never holds private keys. All write operations go through the user's wallet, ensuring the institution controls signing.

### Read path (verify / list)

- The **frontend** reads contract state directly via viem/wagmi (`useReadContract`).
- The **backend API** reads via web3.py for server-side consumers (external integrators, indexers, or server-rendered pages).
- Both paths query the same contract state — they are eventually consistent (same block finality).

## Component Details

### Smart Contract (`CertificateIssuer.sol`)

- **Inheritance:** ERC721 + Ownable (OpenZeppelin v5).
- **Soulbound enforcement:** All transfer/approve functions are overridden to revert with `NonTransferable()`.
- **On-chain metadata:** `tokenURI()` returns a base64-encoded JSON blob with an embedded SVG certificate image.
- **Events:** `CertificateIssued` and `CertificateRevoked` for off-chain indexing.
- **Access control:** `onlyOwner` for `issueCertificate()` and `revoke()`.

### Backend API (`apps/api/`)

- **Framework:** FastAPI with Pydantic validation.
- **Contract interaction:** Read-only via web3.py `HTTPProvider`.
- **Endpoints:**
  - `GET /api/v1/health` — health check with RPC connectivity status.
  - `GET /api/v1/certificates` — list all certificates via event logs.
  - `GET /api/v1/certificates/{id}` — fetch certificate details.
  - `GET /api/v1/certificates/{id}/verify` — verify status (valid/revoked/nonexistent).
  - `GET /api/v1/certificates/{id}/metadata` — fetch on-chain tokenURI.
- **CORS:** Configurable allowed origins.

### Frontend (`apps/web/`)

- **Framework:** Next.js 16 (App Router).
- **Wallet:** RainbowKit + wagmi + viem.
- **Pages:**
  - `/` — Landing page with feature overview.
  - `/verify` — Public certificate verification by token ID.
  - `/dashboard` — Institution-only page (issue + revoke) with ownership check.
- **Styling:** Tailwind CSS v4.

### Shared Package (`packages/web3/`)

- Contract ABI as `const` assertion for full viem type inference.
- Address registry per chain ID.
- Type definitions (`CertificateData`, `CertificateStatus`).
