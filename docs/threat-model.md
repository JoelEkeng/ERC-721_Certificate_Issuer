# Threat Model — CertificateIssuer

This document analyzes security threats applicable to the `CertificateIssuer` soulbound ERC-721 contract, identifies mitigations implemented in the current code, and records residual risks. It is not a substitute for a professional external audit.

## Assets

| Asset | Sensitivity | Location |
|---|---|---|
| Institution private key | **Critical** | User's wallet (never in backend/code) |
| Contract owner role | **Critical** | On-chain (`Ownable`) |
| Certificate data | Public (by design) | On-chain (contract storage) |
| Deployed bytecode | Public | On-chain |
| RPC endpoint URL | Low | `.env` (not committed) |
| WalletConnect project ID | Low | `.env.local` (public-facing key) |

---

## Threat Analysis

### 1. Unauthorized Certificate Issuance

**Threat:** An attacker calls `issueCertificate` to mint fraudulent certificates.

**Mitigations:**
- `onlyOwner` modifier restricts issuance to the contract owner.
- OpenZeppelin `Ownable` uses `OwnableUnauthorizedAccount` custom errors for clear failure.
- Backend holds no private keys and cannot sign transactions.
- Tested: `testMultipleActorsCannotIssue` verifies 5 different accounts are all rejected, `testFuzzOnlyOwnerCanIssue` fuzzes 256 random callers.

**Residual risk:** Owner key compromise. **Recommendation:** Use a multisig (Gnosis Safe) as owner for production.

### 2. Unauthorized Revocation

**Threat:** An attacker revokes valid certificates.

**Mitigations:**
- `onlyOwner` modifier on `revoke()`.
- Even the certificate holder cannot revoke their own certificate.
- Tested: `testMultipleActorsCannotRevoke` verifies holder, attacker, and random addresses are rejected. `testFuzzOnlyOwnerCanRevoke` fuzzes 256 callers.

**Residual risk:** Same as issuance — owner key compromise.

### 3. Transfer Restriction Bypasses

**Threat:** A certificate holder transfers or sells the soulbound NFT.

**Mitigations:**
- All five public state-changing ERC-721 functions are overridden to revert:
  - `approve(address, uint256)` → `NonTransferable()`
  - `setApprovalForAll(address, bool)` → `NonTransferable()`
  - `transferFrom(address, address, uint256)` → `NonTransferable()`
  - `safeTransferFrom(address, address, uint256, bytes)` → `NonTransferable()`
  - The 3-argument `safeTransferFrom` is non-virtual in OZ v5.7 and delegates to the 4-argument version, which is blocked.
- Even the contract owner cannot transfer certificates after minting.
- Internal `_burn`, `_transfer`, `_update` are never called from any public path in the contract.
- Tested: `testTransferFromBlocked`, `testSafeTransferFromBlocked`, `testSafeTransferFromWithDataBlocked`, `testTransferFromBlockedByOwner`, `testApproveBlocked`, `testSetApprovalForAllBlocked`, `testFuzzTransferAlwaysBlocked` (256 runs).
- Invariant: `invariant_ownershipNeverChanges` verified across 128,000 random calls.

**Residual risk:** None identified. No public code path in the contract can move a token after minting.

### 4. Approval and Operator Behavior

**Threat:** An attacker sets approvals or operators to gain transfer capability.

**Mitigations:**
- `approve` and `setApprovalForAll` both revert unconditionally.
- Since no approvals are ever granted, `getApproved` always returns `address(0)` and `isApprovedForAll` always returns `false`.
- The contract is ERC-721 compliant — it implements the interface, but the soulbound nature means approvals serve no purpose and are safely blocked.

**Compatibility note:** Marketplaces that require approval before listing will fail gracefully — the approval transaction reverts.

### 5. Incorrect Existence Checks

**Threat:** Querying a nonexistent token returns misleading data (e.g., appears valid).

**Mitigations:**
- `verifyCertificate` returns `CertificateStatus.Nonexistent` with `address(0)` owner and empty metadata for tokens that don't exist. It never reverts.
- `getCertificate` reverts with `ERC721NonexistentToken` for nonexistent tokens (using `_requireOwned`).
- `tokenURI` reverts with `ERC721NonexistentToken` for nonexistent tokens.
- The `certificates` public mapping returns zero/empty defaults for unset keys, but the explicit `verifyCertificate` function is the intended verification API.

### 6. Incorrect Certificate Verification

**Threat:** A revoked certificate appears valid, or a valid one appears revoked.

**Mitigations:**
- `verifyCertificate` reads `_ownerOf` (for existence) and `cert.revoked` (for revocation) in the same call.
- Revocation sets `revoked = true` in storage and is immediately visible to subsequent reads.
- Tested: `testVerifyCertificateValid`, `testVerifyCertificateRevoked`, `testVerifyCertificateNonexistent`.
- Invariant: `invariant_revokedNeverValid` verified across 128,000 calls — a revoked certificate never returns `Valid`.

### 7. Token ID Collisions

**Threat:** Two certificates receive the same token ID, overwriting data.

**Mitigations:**
- Token IDs use a monotonic counter (`_nextTokenId++`). Collision is impossible absent overflow.
- `uint256` overflow at 2^256 is physically unreachable.
- `_safeMint` would revert with `ERC721InvalidSender` if a token ID already exists (OZ `_update` checks).
- Tested: `testMultipleCertificatesHaveUniqueIds`, `testTokenIdNeverReused` (revoke doesn't free IDs), `testFuzzSequentialTokenIds` (up to 50 sequential IDs per run, 256 runs).
- Invariant: `invariant_tokenIdsAreSequential`.

### 8. Metadata Encoding and SVG Injection

**Threat:** User-supplied text (names, course titles) containing `<script>`, XML entities, or JSON-breaking characters corrupts the metadata or enables XSS in SVG viewers.

**Mitigations:**
- **Separate escaping for each context:**
  - `_escapeXml`: escapes `&`, `<`, `>`, `"`, `'` → XML entities. Used for SVG text elements.
  - `_escapeJson`: escapes `\`, `"`, and all control characters (`< 0x20`) → `\uXXXX`. Used for JSON string values.
- SVG content is Base64-encoded inside the `image` field, adding a layer of encoding.
- JSON content is Base64-encoded in the data URI, adding another layer.
- Max-length limits (128/256 bytes) bound the output size.
- Tested: `testIssueCertificateWithSpecialCharsInName`, `testIssueCertificateWithSpecialCharsInCourse`, `testIssueCertificateWithAmpersandAndQuotes`, `testIssueCertificateWithUnicode`.

**Residual risk:** Exotic Unicode (RTL override, zero-width joiners) could confuse visual rendering but cannot break the SVG/JSON structure.

### 9. Integer and Timestamp Assumptions

**Threat:** Overflow in token ID counter, or miner-manipulated timestamps affecting certificate dates.

**Mitigations:**
- Token ID counter is `uint256` — overflow is physically impossible.
- `block.timestamp` is used for `issueDate`. Miners can manipulate timestamps by roughly ±15 seconds. For certificate dates (day-level granularity), this is immaterial.
- The `_formatTimestamp` function uses a well-known civil calendar algorithm that handles dates from epoch through year 2100+.
- Tested: `testIssueDateMatchesBlockTimestamp`, `testIssueDateAtZeroTimestamp`, `testIssueDateFarFuture` (year ~2100).

### 10. Ownership Transfer and Renunciation

**Threat:** Owner accidentally or maliciously transfers ownership to an uncontrolled address, or renounces ownership, permanently bricking issuance/revocation.

**Mitigations:**
- `renounceOwnership()` is overridden to revert with `OwnershipRenunciationDisabled()`.
- `transferOwnership(address(0))` reverts with OZ's `OwnableInvalidOwner`.
- `transferOwnership` requires `onlyOwner`, preventing unauthorized changes.
- `OwnershipTransferred` event is emitted by OZ on every ownership change.
- Tested: `testRenounceOwnershipReverts`, `testCannotTransferOwnershipToZero`, `testNonOwnerCannotTransferOwnership`, `testOwnershipTransferRevokesOldOwnerAuthority`.

**Residual risk:** If ownership is transferred to a correct but later-compromised address, the new owner has full authority. **Recommendation:** Transfer to a multisig, not an EOA.

### 11. Gas Denial-of-Service via Unbounded Strings

**Threat:** An attacker (or careless owner) stores extremely long strings that make `tokenURI` too expensive to call.

**Mitigations:**
- `MAX_NAME_LENGTH = 128` bytes and `MAX_COURSE_TITLE_LENGTH = 256` bytes enforce bounded storage.
- `_escapeXml` and `_escapeJson` allocate worst-case buffers based on input length, which is bounded.
- Tested: `testIssueCertificateWithMaxLengthStringsSucceeds` verifies tokenURI works with maximum-length inputs (1.37M gas — well within block limits).

**Note:** Only the contract owner can call `issueCertificate`, so the DoS attacker would have to be the institution itself.

### 12. Reentrancy and Unsafe Callback Interactions

**Threat:** `_safeMint` calls `onERC721Received` on contract recipients, creating a callback opportunity.

**Mitigations:**
- All state writes (certificate storage, counter increment) occur **before** the `_safeMint` callback.
- Even if a malicious recipient reenters `issueCertificate`, it reverts because:
  - The callback is executed by the recipient contract, not the owner.
  - `onlyOwner` blocks the reentrant call.
- If the recipient contract reverts in `onERC721Received`, the entire `issueCertificate` transaction rolls back atomically (no partial state).
- Tested: `testReentrancyViaOnERC721ReceivedBlocked` uses a `MaliciousRecipient` contract that attempts reentry.
- Tested: `testRevertingRecipientRollsBackIssuance` verifies atomic rollback when the recipient rejects.
- Tested: `testNonERC721RecipientReverts` verifies contracts without `IERC721Receiver` are rejected.

### 13. Incorrect Event Semantics

**Threat:** Events emit incorrect data, misleading off-chain indexers.

**Mitigations:**
- `CertificateIssued` includes `indexed tokenId`, `indexed recipient`, and full metadata. Emitted after successful mint.
- `CertificateRevoked` includes `indexed tokenId`. Emitted after the `revoked` flag is set.
- ERC-721 `Transfer` event fires on mint (from `address(0)` to recipient) — standard behavior.
- `OwnershipTransferred` fires on ownership changes — inherited from OZ `Ownable`.
- Tested: `testCertificateIssuedEventFields` with `vm.warp` for exact timestamp matching, `testCertificateRevokedEventField`.

**Note:** The `CertificateIssued` event is emitted after `_safeMint`, which includes the `onERC721Received` callback. A reentrancy-aware indexer should be aware that log ordering within a transaction could include events from the callback. This is standard ERC-721 behavior.

### 14. Front-Running and Transaction Ordering

**Threat:** An attacker front-runs an issuance or revocation transaction.

**Analysis:** This is **not applicable** in a meaningful way:
- Only the owner can issue/revoke. An attacker cannot front-run with their own issue/revoke because they lack authority.
- There is no economic benefit to front-running certificate operations (no DeFi-style extraction).
- Token IDs are sequential, so a front-runner cannot predict or claim a specific ID ahead of the owner.

### 15. Deployment Misconfiguration

**Threat:** Contract deployed to wrong network, with wrong owner, or with incorrect parameters.

**Mitigations:**
- Deployment script supports `EXPECTED_CHAIN_ID` env var — reverts if the RPC chain ID doesn't match.
- Constructor arguments (name, symbol) are configurable via `CERTIFICATE_NAME` and `CERTIFICATE_SYMBOL`.
- Post-deployment logging shows contract address, owner, name, and symbol.
- Tested: Deployment simulation with correct and incorrect chain ID both verified.

### 16. Malicious Recipients and Contract-Wallet Recipients

**Threat:** Issuing a certificate to a contract address that rejects or exploits the `onERC721Received` callback.

**Mitigations:**
- `_safeMint` checks `onERC721Received` on contract recipients. Contracts that don't implement it are rejected.
- Contracts that revert in the callback cause the entire issuance to roll back atomically.
- This is working as intended — the institution should verify recipient addresses before issuing.
- Tested: `testNonERC721RecipientReverts`, `testRevertingRecipientRollsBackIssuance`.

---

## Summary of Residual Risks

| Risk | Severity | Mitigation |
|---|---|---|
| Owner key compromise | **High** | Use multisig for production |
| No upgrade path | **Medium** | Redeployment required for bug fixes |
| Timestamp manipulation (±15s) | **Negligible** | Day-level granularity makes this immaterial |
| Exotic Unicode in SVG | **Low** | Structural safety maintained; visual confusion possible |
| No batch operations | **Low** | Sequential issuance has higher gas cost |

## Audit Status

This contract has **not** undergone a professional external audit. The analysis above is based on manual code review, automated testing (78 tests including invariant and fuzz campaigns), and threat modeling. A professional audit is recommended before production deployment with real credentials.

## Future Enhancements

- **Multisig ownership:** Use a Gnosis Safe as the contract owner.
- **Batch issuance:** Add `batchIssueCertificates()` to reduce gas for bulk operations.
- **EIP-5192 (Minimal Soulbound):** Implement the `IERC5192` interface for standard soulbound detection.
- **Event indexer:** Use The Graph or a database-backed indexer for production-scale listing.
- **Pausable:** Add OpenZeppelin `Pausable` for emergency circuit breaker if needed.
