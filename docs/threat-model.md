# Threat Model

## Assets

| Asset | Sensitivity | Location |
|---|---|---|
| Institution private key | Critical | User's wallet (never in backend/code) |
| Contract owner role | Critical | On-chain (Ownable) |
| Certificate data | Public (by design) | On-chain |
| RPC endpoint URL | Low | `.env` (not committed) |
| WalletConnect project ID | Low | `.env.local` (public-facing key) |

## Threat Categories

### 1. Unauthorized Certificate Issuance

**Threat:** An attacker issues fake certificates.

**Mitigations:**
- `onlyOwner` modifier on `issueCertificate()` — only the deployer address can mint.
- Private key never leaves the institution's hardware/software wallet.
- Backend has no signing capability; it cannot issue certificates.

**Residual risk:** If the institution's private key is compromised, an attacker can issue certificates. Mitigation: use a hardware wallet or multi-sig (future enhancement).

### 2. Unauthorized Revocation

**Threat:** An attacker revokes valid certificates.

**Mitigations:**
- `onlyOwner` modifier on `revoke()`.
- Same key security as issuance.

### 3. Certificate Forgery / Tampering

**Threat:** Someone modifies certificate data after issuance.

**Mitigations:**
- Certificate data is stored in contract storage — immutable once written (no update function exists).
- The SVG image is generated from on-chain data at read time, so it always reflects the true state.
- Revocation flag can only be set, never cleared.

### 4. Transfer of Soulbound Tokens

**Threat:** Certificate holder transfers the NFT to sell or mislead.

**Mitigations:**
- All transfer functions (`transferFrom`, `safeTransferFrom`) revert with `NonTransferable()`.
- Approval functions (`approve`, `setApprovalForAll`) also revert.
- The ERC-721 `Transfer` event still fires on mint (from `address(0)`), which is correct.

### 5. Frontend State Manipulation

**Threat:** User manipulates frontend to appear as contract owner.

**Mitigations:**
- The dashboard checks ownership via `useReadContract` (reads chain state).
- Even if bypassed in the UI, the contract's `onlyOwner` revert makes the transaction fail.
- Transaction receipts are verified via `useWaitForTransactionReceipt`.

### 6. Backend as Oracle

**Threat:** Someone trusts backend API responses as the sole source of truth.

**Mitigations:**
- The backend is clearly documented as a read-only convenience layer.
- Verification should be performed on-chain (via `verifyCertificate`) or by reading contract state directly.
- The API surfaces `status` fields that match on-chain state.

### 7. Denial of Service

**Threat:** Mass minting to inflate storage costs or spam.

**Mitigations:**
- Only the owner can mint — rate limiting is inherent.
- Gas costs provide economic disincentive for mass operations.

### 8. Private Key / Secret Exposure

**Threat:** Secrets committed to source control or logged.

**Mitigations:**
- `.env` and `.env.local` are in `.gitignore`.
- `.env.example` contains only placeholder values.
- Backend never handles private keys.
- No secrets are logged or exposed in API responses.

## Future Enhancements

- **Multi-sig ownership:** Use a Gnosis Safe as the contract owner for institutional key management.
- **Batch issuance:** Add a `batchIssueCertificates()` function to reduce gas for bulk operations.
- **Event indexer:** Replace direct RPC log queries with a proper indexer (The Graph or a persistent backend database) for production-scale certificate listing.
- **Rate limiting:** Add API rate limiting for public endpoints.
