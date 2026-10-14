# Deployment Guide

## Prerequisites

- [Foundry](https://getfoundry.sh/) (forge, anvil, cast)
- Node.js >= 18
- Python >= 3.9
- A wallet with testnet ETH (for testnet deployment)
- A WalletConnect project ID (free at [cloud.walletconnect.com](https://cloud.walletconnect.com))

## Local Development

### 1. Start Anvil (local blockchain)

```bash
anvil
```

This starts a local chain on `http://127.0.0.1:8545` with 10 pre-funded accounts.
Note the first account's private key — it will be the contract owner.

### 2. Deploy the contract

```bash
cd packages/contracts
forge script script/DeployCertificateIssuer.s.sol:DeployCertificateIssuer \
  --rpc-url http://127.0.0.1:8545 \
  --private-key <ANVIL_PRIVATE_KEY> \
  --broadcast
```

Copy the deployed contract address from the output.

### 3. Configure environment

```bash
# Backend
cp .env.example apps/api/.env
# Edit apps/api/.env: set CONTRACT_ADDRESS to deployed address

# Frontend
cp .env.example apps/web/.env.local
# Edit apps/web/.env.local: set NEXT_PUBLIC_CONTRACT_ADDRESS
```

### 4. Start the backend

```bash
cd apps/api
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

API docs: http://localhost:8000/docs

### 5. Start the frontend

```bash
cd apps/web
npm install
npm run dev
```

Open http://localhost:3000.

### 6. Connect and test

1. Import an Anvil account into MetaMask (using the private key from step 1).
2. Add the Hardhat network to MetaMask (chain ID 31337, RPC http://127.0.0.1:8545).
3. Navigate to `/dashboard` and connect the owner wallet.
4. Issue a certificate and verify it at `/verify`.

## Testnet Deployment (Sepolia / Lisk Sepolia)

### 1. Set environment variables

```bash
export RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY
export PRIVATE_KEY=your_deployer_private_key  # DO NOT commit this
```

### 2. Deploy

```bash
cd packages/contracts
forge script script/DeployCertificateIssuer.s.sol:DeployCertificateIssuer \
  --rpc-url $RPC_URL \
  --private-key $PRIVATE_KEY \
  --broadcast \
  --verify
```

### 3. Update addresses

Update the contract address in:
- `apps/web/.env.local` (`NEXT_PUBLIC_CONTRACT_ADDRESS`)
- `apps/api/.env` (`CONTRACT_ADDRESS`)
- `packages/web3/src/addresses.ts` (for the relevant chain ID)

### 4. Verify contract on Etherscan (optional)

```bash
forge verify-contract <DEPLOYED_ADDRESS> src/CertificateIssuer.sol:CertificateIssuer \
  --chain sepolia \
  --constructor-args $(cast abi-encode "constructor(string,string)" "On-Chain Certificate" "CERT")
```

## Production Considerations

- Use a hardware wallet or multi-sig for the contract owner.
- Deploy the backend behind a reverse proxy with rate limiting.
- Consider using The Graph or a database-backed indexer instead of direct RPC event queries.
- Set up monitoring for `CertificateIssued` and `CertificateRevoked` events.
- Pin frontend to specific RPC URLs (not public defaults) for reliability.
