# Deployment Guide

## Prerequisites

- [Foundry](https://getfoundry.sh/) (`forge`, `anvil`, `cast`)
- Node.js >= 18
- Python >= 3.9
- A wallet with testnet ETH (for testnet deployment)
- A WalletConnect project ID (free at [cloud.walletconnect.com](https://cloud.walletconnect.com))

## Toolchain Versions

| Tool | Version | Notes |
|---|---|---|
| Solidity compiler | `0.8.27` | Pinned in `foundry.toml` |
| OpenZeppelin Contracts | `v5.7.0` | Git submodule |
| forge-std | Latest | Vendored in `lib/` |
| Foundry | Latest stable | Optimizer enabled, `via_ir = true` |

---

## Local Development (Anvil)

### 1. Start Anvil

```bash
anvil --chain-id 31337
```

This starts a local chain on `http://127.0.0.1:8545` with 10 pre-funded accounts.
The first account (`0xf39Fd...`) is the default deployer.

Default private key (Anvil account 0 — test only, never use on mainnet):
```
0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
```

### 2. Run tests

```bash
cd packages/contracts

# Run all tests
forge test

# Run with verbose output (see traces for failures)
forge test -vvv

# Run a specific test
forge test --match-test testIssueCertificate -vvv

# Generate gas snapshot
forge snapshot
```

### 3. Deploy to Anvil

```bash
cd packages/contracts

# Deploy with chain-ID safety guard
EXPECTED_CHAIN_ID=31337 forge script script/DeployCertificateIssuer.s.sol:DeployCertificateIssuer \
  --rpc-url http://127.0.0.1:8545 \
  --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 \
  --broadcast
```

The output shows the deployed contract address and owner. Example:
```
=== Deployment Successful ===
Contract:      0x5FbDB2315678afecb367f032d93F642f64180aa3
Owner:         0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
```

### 4. Verify the deployment with Cast

```bash
# Confirm the owner
cast call 0x5FbDB2315678afecb367f032d93F642f64180aa3 \
  "owner()(address)" \
  --rpc-url http://127.0.0.1:8545

# Check contract name
cast call 0x5FbDB2315678afecb367f032d93F642f64180aa3 \
  "name()(string)" \
  --rpc-url http://127.0.0.1:8545

# Check total issued
cast call 0x5FbDB2315678afecb367f032d93F642f64180aa3 \
  "totalIssued()(uint256)" \
  --rpc-url http://127.0.0.1:8545
```

### 5. Issue a certificate via Cast

```bash
cast send 0x5FbDB2315678afecb367f032d93F642f64180aa3 \
  "issueCertificate(address,string,string)" \
  0x70997970C51812dc3A010C7d01b50e0d17dc79C8 \
  "Alice Johnson" \
  "Solidity 101" \
  --rpc-url http://127.0.0.1:8545 \
  --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
```

### 6. Verify a certificate

```bash
# Full verification (returns status enum, owner, name, course, date)
# Status: 0 = Nonexistent, 1 = Valid, 2 = Revoked
cast call 0x5FbDB2315678afecb367f032d93F642f64180aa3 \
  "verifyCertificate(uint256)((uint8,address,string,string,uint256))" \
  0 \
  --rpc-url http://127.0.0.1:8545

# Get full certificate details
cast call 0x5FbDB2315678afecb367f032d93F642f64180aa3 \
  "getCertificate(uint256)(address,string,string,uint256,bool)" \
  0 \
  --rpc-url http://127.0.0.1:8545
```

### 7. Inspect a transaction receipt

```bash
cast receipt <TX_HASH> --rpc-url http://127.0.0.1:8545
```

Check `status` field: `0x1` = success, `0x0` = revert.

### 8. Revoke a certificate

```bash
cast send 0x5FbDB2315678afecb367f032d93F642f64180aa3 \
  "revoke(uint256)" \
  0 \
  --rpc-url http://127.0.0.1:8545 \
  --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
```

### 9. Configure frontend and backend

```bash
# Backend
cp .env.example apps/api/.env
# Edit apps/api/.env: set CONTRACT_ADDRESS to deployed address

# Frontend
cp .env.example apps/web/.env.local
# Edit apps/web/.env.local: set NEXT_PUBLIC_CONTRACT_ADDRESS
```

### 10. Start services

```bash
# Backend
cd apps/api
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# Frontend (separate terminal)
cd apps/web
npm install
npm run dev
```

---

## Testnet Deployment (Sepolia)

### 1. Set environment variables

```bash
export RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY
export PRIVATE_KEY=your_deployer_private_key  # NEVER commit this
export EXPECTED_CHAIN_ID=11155111             # Sepolia chain ID
```

### 2. Deploy with chain-ID guard

```bash
cd packages/contracts

EXPECTED_CHAIN_ID=$EXPECTED_CHAIN_ID forge script \
  script/DeployCertificateIssuer.s.sol:DeployCertificateIssuer \
  --rpc-url $RPC_URL \
  --private-key $PRIVATE_KEY \
  --broadcast \
  --verify
```

The `--verify` flag submits the source to Etherscan for verification.

If the chain ID doesn't match `EXPECTED_CHAIN_ID`, the script aborts:
```
Error: Chain ID mismatch: expected 11155111 but got 31337. Aborting...
```

### 3. Verify contract on Etherscan (manual)

If `--verify` wasn't used or failed:

```bash
forge verify-contract <DEPLOYED_ADDRESS> \
  src/CertificateIssuer.sol:CertificateIssuer \
  --chain sepolia \
  --etherscan-api-key $ETHERSCAN_API_KEY \
  --constructor-args $(cast abi-encode "constructor(string,string)" "On-Chain Certificate" "CERT")
```

### 4. Update addresses

Update the contract address in:
- `apps/web/.env.local` → `NEXT_PUBLIC_CONTRACT_ADDRESS`
- `apps/api/.env` → `CONTRACT_ADDRESS`
- `packages/web3/src/addresses.ts` → chain ID mapping

---

## Deployment Verification Checklist

After deploying to any network, verify the following:

### Bytecode verification

```bash
# Compare deployed bytecode against local compilation
cast code <DEPLOYED_ADDRESS> --rpc-url $RPC_URL

# The deployment script logs the address — verify it matches
```

On block explorers (Etherscan, etc.), verify the source code tab shows the correct Solidity source after contract verification.

### Owner confirmation

```bash
cast call <DEPLOYED_ADDRESS> "owner()(address)" --rpc-url $RPC_URL
```

This must match the deployer address or the intended institutional multisig.

### ABI publication

After deployment, the ABI is available in:
- `packages/contracts/out/CertificateIssuer.sol/CertificateIssuer.json`
- `packages/web3/src/abi.ts` (TypeScript const assertion)
- `apps/web/src/lib/abi.ts` (frontend copy)

If the contract was verified on a block explorer, the ABI is also available there.

### Network safety

| Check | Command |
|---|---|
| Confirm chain ID | `cast chain-id --rpc-url $RPC_URL` |
| Confirm deployer balance | `cast balance <DEPLOYER> --rpc-url $RPC_URL` |
| Confirm not mainnet | Verify chain ID is NOT `1` before deploying |

The deployment script's `EXPECTED_CHAIN_ID` guard prevents accidental wrong-network deployment.

---

## Deployment Security

### Private key handling

- **Never** hardcode private keys in source code or scripts.
- Use environment variables (`--private-key $PRIVATE_KEY`) or hardware wallets (`--ledger` / `--trezor`).
- For CI/CD: use encrypted secrets (GitHub Actions secrets, AWS Secrets Manager, etc.).
- The Anvil default key (`0xac09...`) is **test-only** — it is publicly known.

### Production key management

For production deployments, the deployer private key becomes the contract owner. Recommendations:

1. **Gnosis Safe (recommended):** Deploy with an EOA, then `transferOwnership` to a Gnosis Safe multisig. This provides:
   - Multi-signature approval for issuance and revocation.
   - Key rotation without redeployment.
   - Transaction queueing and timelock.

2. **Hardware wallet:** Use `--ledger` or `--trezor` flags with `forge script` for hardware-backed signing.

3. **Institutional key custody:** For enterprise deployments, use an institutional custody solution (Fireblocks, Anchorage, etc.) that supports smart contract interactions.

### Post-deployment ownership transfer to multisig

```bash
# Deploy with EOA
forge script ... --broadcast

# Transfer ownership to Gnosis Safe
cast send <CONTRACT_ADDRESS> \
  "transferOwnership(address)" \
  <GNOSIS_SAFE_ADDRESS> \
  --rpc-url $RPC_URL \
  --private-key $DEPLOYER_KEY
```

Verify the transfer:
```bash
cast call <CONTRACT_ADDRESS> "owner()(address)" --rpc-url $RPC_URL
# Should return the Gnosis Safe address
```

### Pre-production checklist

- [ ] All 78 tests pass (`forge test`)
- [ ] Gas snapshot reviewed (`forge snapshot`)
- [ ] Deployment script runs in simulation mode first (no `--broadcast`)
- [ ] Chain ID guard set (`EXPECTED_CHAIN_ID`)
- [ ] Constructor arguments verified (name, symbol)
- [ ] Deployer address has sufficient ETH for gas
- [ ] Contract verified on block explorer
- [ ] Owner confirmed via `cast call ... "owner()(address)"`
- [ ] Test issuance + verification + revocation on testnet
- [ ] Ownership transferred to multisig
- [ ] Frontend and backend configured with correct contract address
- [ ] Private keys not present in any committed file

---

## Gas Snapshot

Run `forge snapshot` to generate `.gas-snapshot` in the contracts directory. This file records gas usage for every test function.

Key operations (approximate gas):

| Operation | Gas |
|---|---|
| `issueCertificate` (typical) | ~189,000 |
| `revoke` | ~48,000 |
| `verifyCertificate` (valid) | ~10,000 |
| `verifyCertificate` (nonexistent) | ~10,000 |
| `getCertificate` | ~10,000 |
| `tokenURI` | ~290,000 |
| `issueCertificate` (max-length strings) | ~1,367,000 |

To compare gas changes between commits:
```bash
forge snapshot --diff .gas-snapshot
```

---

## Test Suites

| Suite | Tests | Purpose |
|---|---|---|
| `CertificateIssuer.t.sol` | 51 | Core functionality, fuzz tests |
| `CertificateIssuerSecurity.t.sol` | 26 | Reentrancy, multi-actor auth, edge cases |
| `CertificateIssuerInvariant.t.sol` | 6 invariants | Stateful invariant testing (128K calls) |
| **Total** | **78 + invariants** | |

```bash
# Run only unit + fuzz tests (fast)
forge test --match-path test/CertificateIssuer.t.sol

# Run security tests
forge test --match-path test/CertificateIssuerSecurity.t.sol

# Run invariant tests (slow — ~3 minutes)
forge test --match-path test/CertificateIssuerInvariant.t.sol
```
