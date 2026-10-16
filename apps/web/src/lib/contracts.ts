/**
 * Contract configuration and typed helpers.
 * Single source of truth for contract address and ABI imports.
 */
import { certificateIssuerAbi } from "./abi";
import { CONTRACT_ADDRESS } from "./config";

/** Re-export for convenience — avoids importing from two places. */
export { certificateIssuerAbi, CONTRACT_ADDRESS };

/** Shared contract config object for wagmi hooks. */
export const certificateContract = {
  address: CONTRACT_ADDRESS,
  abi: certificateIssuerAbi,
} as const;

/** Certificate verification status enum (matches contract). */
export const CertificateStatus = {
  Nonexistent: 0,
  Valid: 1,
  Revoked: 2,
} as const;

export type CertificateStatusType =
  (typeof CertificateStatus)[keyof typeof CertificateStatus];

/** Human-readable status labels. */
export function getStatusLabel(status: number): string {
  switch (status) {
    case CertificateStatus.Valid:
      return "Valid";
    case CertificateStatus.Revoked:
      return "Revoked";
    default:
      return "Not Found";
  }
}
