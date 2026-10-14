# On-Chain Certificate Issuer

A full-stack platform for issuing, verifying, and managing soulbound ERC-721 certificates of completion on EVM-compatible blockchains.

## Features

- **Institution-only issuance** — only the contract owner can mint certificates.
- **Soulbound / non-transferable** — all transfer and approval functions are disabled.
- **On-chain metadata** — each certificate stores recipient name, course title, issue date, and revocation status on-chain.
- **On-chain SVG image** — `tokenURI` returns a Base64-encoded JSON blob with a generated SVG certificate.
- **Public verification** — anyone can verify a certificate by token ID (valid / revoked / nonexistent).
- **Revocation** — the institution can revoke certificates for fraud or error.
- **Event indexing** — `CertificateIssued` and `CertificateRevoked` events for off-chain indexing.
- **REST API** — FastAPI backend for server-side certificate queries.
- **Web dashboard** — Next.js frontend with RainbowKit wallet integration.

## Repository Layout

```text
.
├── packages/
│   ├── contracts/          # Foundry project (Solidity smart contracts + tests)
│   │   ├── src/CertificateIssuer.sol
│   │   ├── test/CertificateIssuer.t.sol
│   │   └── script/DeployCertificateIssuer.s.sol
│   └── web3/               # Shared TypeScript (ABI, addresses, types)
├── apps/
│   ├── web/                # Next.js frontend (RainbowKit + wagmi)
│   └── api/                # FastAPI backend (read-only REST API)
├── docs/                   # Architecture, threat model, deployment guide
├── .env.example            # Environment variable placeholders
└── README.md
```

## Quick Start

### Prerequisites

- [Foundry](https://getfoundry.sh/) (forge, anvil, cast)
- Node.js >= 18
- Python >= 3.9

### 1. Build and test the smart contract

```bash
cd packages/contracts
forge build
forge test -vvv
```

### 2. Start a local chain and deploy

```bash
# Terminal 1: start Anvil
anvil

# Terminal 2: deploy
cd packages/contracts
forge script script/DeployCertificateIssuer.s.sol:DeployCertificateIssuer \
  --rpc-url http://127.0.0.1:8545 \
  --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 \
  --broadcast
```

Copy the deployed contract address from the output.

### 3. Start the backend API

```bash
cd apps/api
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Set the deployed contract address
export CONTRACT_ADDRESS=<your_deployed_address>
uvicorn app.main:app --reload --port 8000
```

API docs: http://localhost:8000/docs

### 4. Start the frontend

```bash
cd apps/web
npm install

# Create .env.local
echo "NEXT_PUBLIC_CONTRACT_ADDRESS=<your_deployed_address>" > .env.local
echo "NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=demo" >> .env.local

npm run dev
```

Open http://localhost:3000.

### 5. Test the full flow

1. Import an Anvil account into MetaMask.
2. Add the Hardhat network (chain ID 31337, RPC http://127.0.0.1:8545).
3. Navigate to `/dashboard` and connect the owner wallet.
4. Issue a certificate.
5. Navigate to `/verify` and verify it by token ID.

## Smart Contract API

| Function | Access | Description |
|---|---|---|
| `issueCertificate(address, string, string)` | Owner only | Mint a new certificate |
| `verifyCertificate(uint256)` | Public (view) | Check if certificate is valid |
| `revoke(uint256)` | Owner only | Revoke a certificate |
| `tokenURI(uint256)` | Public (view) | Get on-chain metadata + SVG |
| `certificates(uint256)` | Public (view) | Read certificate struct |

## Documentation

- [Architecture](docs/architecture.md)
- [Threat Model](docs/threat-model.md)
- [Deployment Guide](docs/deployment.md)

## Toolchain

| Component | Technology | Version |
|---|---|---|
| Smart Contracts | Solidity | 0.8.27 |
| Contract Framework | Foundry | latest |
| Dependencies | OpenZeppelin Contracts | v5.x |
| Frontend | Next.js | 16.x |
| Wallet | RainbowKit + wagmi + viem | 2.x |
| Backend | FastAPI + web3.py | 0.115.x / 7.x |
| Styling | Tailwind CSS | v4 |

## License

MIT
