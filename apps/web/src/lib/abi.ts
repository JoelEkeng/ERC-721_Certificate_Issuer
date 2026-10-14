/**
 * CertificateIssuer contract ABI.
 * Duplicated from packages/web3 for Next.js bundler compatibility
 * (avoids external workspace resolution issues).
 */
export const certificateIssuerAbi = [
  {
    type: "constructor",
    inputs: [
      { name: "name", type: "string" },
      { name: "symbol", type: "string" },
    ],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "balanceOf",
    inputs: [{ name: "owner", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "certificates",
    inputs: [{ name: "", type: "uint256" }],
    outputs: [
      { name: "recipientName", type: "string" },
      { name: "courseTitle", type: "string" },
      { name: "issueDate", type: "uint256" },
      { name: "revoked", type: "bool" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "name",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "owner",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "ownerOf",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "symbol",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "tokenURI",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "", type: "string" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "verifyCertificate",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "issueCertificate",
    inputs: [
      { name: "recipient", type: "address" },
      { name: "recipientName", type: "string" },
      { name: "courseTitle", type: "string" },
    ],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "revoke",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "renounceOwnership",
    inputs: [],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "transferOwnership",
    inputs: [{ name: "newOwner", type: "address" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "event",
    name: "CertificateIssued",
    inputs: [
      { name: "tokenId", type: "uint256", indexed: true },
      { name: "recipient", type: "address", indexed: true },
      { name: "recipientName", type: "string", indexed: false },
      { name: "courseTitle", type: "string", indexed: false },
      { name: "issueDate", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "CertificateRevoked",
    inputs: [{ name: "tokenId", type: "uint256", indexed: true }],
  },
  {
    type: "event",
    name: "Transfer",
    inputs: [
      { name: "from", type: "address", indexed: true },
      { name: "to", type: "address", indexed: true },
      { name: "tokenId", type: "uint256", indexed: true },
    ],
  },
  {
    type: "event",
    name: "OwnershipTransferred",
    inputs: [
      { name: "previousOwner", type: "address", indexed: true },
      { name: "newOwner", type: "address", indexed: true },
    ],
  },
  { type: "error", name: "CertificateAlreadyRevoked", inputs: [] },
  { type: "error", name: "CertificateNonExistent", inputs: [] },
  { type: "error", name: "EmptyCourseTitle", inputs: [] },
  { type: "error", name: "EmptyRecipientName", inputs: [] },
  { type: "error", name: "InvalidRecipient", inputs: [] },
  { type: "error", name: "NonTransferable", inputs: [] },
  {
    type: "error",
    name: "ERC721NonexistentToken",
    inputs: [{ name: "tokenId", type: "uint256" }],
  },
  {
    type: "error",
    name: "OwnableUnauthorizedAccount",
    inputs: [{ name: "account", type: "address" }],
  },
] as const;
