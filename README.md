# On-Chain Certificate Issuer

A Foundry-based Solidity project implementing an ERC-721 certificate-of-completion contract.

## Features

- **Institution-only issuance**: Only the contract owner (the institution) can mint certificates.
- **On-chain metadata**: Each certificate stores recipient name, course title, issue date, and revocation status on-chain.
- **Soulbound / non-transferable**: All transfer and approval functions are disabled so certificates remain with the original recipient.
- **Public verification**: `verifyCertificate(tokenId)` returns `true` only if the token exists and has not been revoked.
- **On-chain image**: `tokenURI` returns a Base64-encoded JSON metadata blob with a generated SVG certificate.
- **Revocation**: The owner can revoke a certificate, e.g. for fraud or error.

## Project Layout

```text
.
├── foundry.toml
├── script/
│   └── DeployCertificateIssuer.s.sol   # Deployment script
├── src/
│   └── CertificateIssuer.sol             # Main ERC-721 contract
└── test/
    └── CertificateIssuer.t.sol           # Foundry tests
```

## Getting Started

Build the project:

```shell
forge build
```

Run the tests:

```shell
forge test
```

Format the code:

```shell
forge fmt
```

## Deployment

Set the optional environment variables `CERTIFICATE_NAME` and `CERTIFICATE_SYMBOL`, then run:

```shell
forge script script/DeployCertificateIssuer.s.sol:DeployCertificateIssuer \
  --rpc-url <your_rpc_url> \
  --private-key <your_private_key> \
  --broadcast
```

If omitted, the contract deploys with name `On-Chain Certificate` and symbol `CERT`.

## Key Contract Functions

- `issueCertificate(address recipient, string memory recipientName, string memory courseTitle)` — mint a new certificate.
- `verifyCertificate(uint256 tokenId)` — verify that a certificate exists and is not revoked.
- `revoke(uint256 tokenId)` — invalidate an existing certificate (owner only).
- `tokenURI(uint256 tokenId)` — return on-chain metadata + SVG image.

## License

MIT
