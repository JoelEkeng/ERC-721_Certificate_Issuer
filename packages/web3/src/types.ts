import type { Address } from "viem";

/** On-chain certificate data as returned by the `certificates` mapping. */
export interface CertificateData {
  tokenId: bigint;
  recipientName: string;
  courseTitle: string;
  issueDate: bigint;
  revoked: boolean;
  owner: Address;
}

/** Certificate verification result. */
export type CertificateStatus = "valid" | "revoked" | "nonexistent";

/** Determine certificate status from on-chain data. */
export function getCertificateStatus(
  exists: boolean,
  revoked: boolean
): CertificateStatus {
  if (!exists) return "nonexistent";
  return revoked ? "revoked" : "valid";
}
