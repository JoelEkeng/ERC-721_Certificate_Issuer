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

/** Certificate verification status returned by the contract enum. */
export enum CertificateStatusEnum {
  Nonexistent = 0,
  Valid = 1,
  Revoked = 2,
}

/** Certificate verification result as returned by `verifyCertificate`. */
export interface VerificationResult {
  status: CertificateStatusEnum;
  owner: Address;
  recipientName: string;
  courseTitle: string;
  issueDate: bigint;
}

/** String-based certificate status for display purposes. */
export type CertificateStatus = "valid" | "revoked" | "nonexistent";

/** Convert contract enum to display status string. */
export function statusToString(status: CertificateStatusEnum): CertificateStatus {
  switch (status) {
    case CertificateStatusEnum.Valid:
      return "valid";
    case CertificateStatusEnum.Revoked:
      return "revoked";
    default:
      return "nonexistent";
  }
}

/** Determine certificate status from on-chain data. */
export function getCertificateStatus(
  exists: boolean,
  revoked: boolean
): CertificateStatus {
  if (!exists) return "nonexistent";
  return revoked ? "revoked" : "valid";
}
