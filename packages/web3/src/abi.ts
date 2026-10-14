/**
 * CertificateIssuer contract ABI — extracted from Foundry compilation output.
 * Typed as `const` for viem/wagmi type inference.
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
  // --- Read functions ---
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
    name: "getApproved",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "isApprovedForAll",
    inputs: [
      { name: "owner", type: "address" },
      { name: "operator", type: "address" },
    ],
    outputs: [{ name: "", type: "bool" }],
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
    name: "supportsInterface",
    inputs: [{ name: "interfaceId", type: "bytes4" }],
    outputs: [{ name: "", type: "bool" }],
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
  // --- Write functions ---
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
  // Transfer/approve functions (all revert with NonTransferable)
  {
    type: "function",
    name: "approve",
    inputs: [
      { name: "", type: "address" },
      { name: "", type: "uint256" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "setApprovalForAll",
    inputs: [
      { name: "", type: "address" },
      { name: "", type: "bool" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "transferFrom",
    inputs: [
      { name: "", type: "address" },
      { name: "", type: "address" },
      { name: "", type: "uint256" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "safeTransferFrom",
    inputs: [
      { name: "from", type: "address" },
      { name: "to", type: "address" },
      { name: "tokenId", type: "uint256" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "safeTransferFrom",
    inputs: [
      { name: "", type: "address" },
      { name: "", type: "address" },
      { name: "", type: "uint256" },
      { name: "", type: "bytes" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  // --- Events ---
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
    name: "Approval",
    inputs: [
      { name: "owner", type: "address", indexed: true },
      { name: "approved", type: "address", indexed: true },
      { name: "tokenId", type: "uint256", indexed: true },
    ],
  },
  {
    type: "event",
    name: "ApprovalForAll",
    inputs: [
      { name: "owner", type: "address", indexed: true },
      { name: "operator", type: "address", indexed: true },
      { name: "approved", type: "bool", indexed: false },
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
  // --- Custom errors ---
  { type: "error", name: "CertificateAlreadyRevoked", inputs: [] },
  { type: "error", name: "CertificateNonExistent", inputs: [] },
  { type: "error", name: "EmptyCourseTitle", inputs: [] },
  { type: "error", name: "EmptyRecipientName", inputs: [] },
  { type: "error", name: "InvalidRecipient", inputs: [] },
  { type: "error", name: "NonTransferable", inputs: [] },
  {
    type: "error",
    name: "ERC721IncorrectOwner",
    inputs: [
      { name: "sender", type: "address" },
      { name: "tokenId", type: "uint256" },
      { name: "owner", type: "address" },
    ],
  },
  {
    type: "error",
    name: "ERC721InsufficientApproval",
    inputs: [
      { name: "operator", type: "address" },
      { name: "tokenId", type: "uint256" },
    ],
  },
  {
    type: "error",
    name: "ERC721InvalidApprover",
    inputs: [{ name: "approver", type: "address" }],
  },
  {
    type: "error",
    name: "ERC721InvalidOperator",
    inputs: [{ name: "operator", type: "address" }],
  },
  {
    type: "error",
    name: "ERC721InvalidOwner",
    inputs: [{ name: "owner", type: "address" }],
  },
  {
    type: "error",
    name: "ERC721InvalidReceiver",
    inputs: [{ name: "receiver", type: "address" }],
  },
  {
    type: "error",
    name: "ERC721InvalidSender",
    inputs: [{ name: "sender", type: "address" }],
  },
  {
    type: "error",
    name: "ERC721NonexistentToken",
    inputs: [{ name: "tokenId", type: "uint256" }],
  },
  {
    type: "error",
    name: "OwnableInvalidOwner",
    inputs: [{ name: "owner", type: "address" }],
  },
  {
    type: "error",
    name: "OwnableUnauthorizedAccount",
    inputs: [{ name: "account", type: "address" }],
  },
] as const;
