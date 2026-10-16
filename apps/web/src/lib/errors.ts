/**
 * Contract and wallet error translation.
 * Converts raw error objects into user-readable messages.
 */

/** Known contract custom error signatures. */
const CONTRACT_ERRORS: Record<string, string> = {
  EmptyRecipientName: "Recipient name cannot be empty.",
  EmptyCourseTitle: "Course title cannot be empty.",
  InvalidRecipient: "Invalid recipient address.",
  RecipientNameTooLong: "Recipient name exceeds maximum length (128 bytes).",
  CourseTitleTooLong: "Course title exceeds maximum length (256 bytes).",
  CertificateNonExistent: "Certificate does not exist.",
  CertificateAlreadyRevoked: "Certificate is already revoked.",
  NonTransferable: "Certificates are non-transferable.",
  OwnershipRenunciationDisabled: "Ownership renunciation is disabled.",
  OwnableUnauthorizedAccount: "You are not authorized to perform this action.",
  OwnableInvalidOwner: "Invalid owner address.",
  ERC721NonexistentToken: "Token does not exist.",
};

export function translateError(error: unknown): string {
  if (!error) return "An unknown error occurred.";

  const message =
    error instanceof Error ? error.message : String(error);

  // Check for user rejection
  if (
    message.includes("User rejected") ||
    message.includes("user rejected") ||
    message.includes("User denied")
  ) {
    return "Transaction was rejected in your wallet.";
  }

  // Check for insufficient funds
  if (
    message.includes("insufficient funds") ||
    message.includes("exceeds balance")
  ) {
    return "Insufficient funds to cover gas costs.";
  }

  // Check for contract custom errors
  for (const [name, humanMessage] of Object.entries(CONTRACT_ERRORS)) {
    if (message.includes(name)) {
      return humanMessage;
    }
  }

  // Check for network errors
  if (
    message.includes("network") ||
    message.includes("disconnected") ||
    message.includes("timeout")
  ) {
    return "Network error. Please check your connection and try again.";
  }

  // Truncate long messages
  const firstLine = message.split("\n")[0];
  if (firstLine.length > 120) {
    return firstLine.slice(0, 117) + "...";
  }
  return firstLine;
}
