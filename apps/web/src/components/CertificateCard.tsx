"use client";

import { CertificateStatus, getStatusLabel } from "@/lib/contracts";

interface CertificateCardProps {
  recipientName: string;
  courseTitle: string;
  issueDate: bigint;
  owner: string;
  tokenId: string;
  status: number;
  contractAddress: string;
  /** When true, shows a larger layout suitable for detail/print view. */
  detailed?: boolean;
}

function formatDate(timestamp: bigint): string {
  if (timestamp === 0n) return "Unknown";
  const date = new Date(Number(timestamp) * 1000);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function truncateAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export default function CertificateCard({
  recipientName,
  courseTitle,
  issueDate,
  owner,
  tokenId,
  status,
  contractAddress,
  detailed = false,
}: CertificateCardProps) {
  const isRevoked = status === CertificateStatus.Revoked;

  return (
    <div
      className={`relative overflow-hidden rounded-xl border ${
        isRevoked
          ? "border-destructive/30 bg-destructive/5"
          : "border-card-border bg-card"
      } ${detailed ? "p-8 sm:p-12" : "p-6"}`}
    >
      {/* Revoked watermark */}
      {isRevoked && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span
            className="select-none text-6xl font-black uppercase tracking-widest text-destructive/10 sm:text-8xl"
            style={{ transform: "rotate(-30deg)" }}
            aria-hidden="true"
          >
            Revoked
          </span>
        </div>
      )}

      <div className="relative z-10 text-center">
        {/* Status badge */}
        <div className="mb-4 flex justify-center">
          <span
            className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
              isRevoked
                ? "bg-destructive/10 text-destructive"
                : "bg-success/10 text-success"
            }`}
          >
            {getStatusLabel(status)}
          </span>
        </div>

        <p
          className={`uppercase tracking-widest text-muted ${
            detailed ? "text-sm" : "text-xs"
          }`}
        >
          Certificate of Completion
        </p>
        <div className="mx-auto my-4 h-px w-16 bg-card-border" />

        <p
          className={`font-bold text-foreground ${
            detailed ? "text-2xl sm:text-3xl" : "text-xl"
          }`}
        >
          {recipientName}
        </p>
        <p className="mt-2 text-sm text-muted">has successfully completed</p>
        <p
          className={`mt-1 font-semibold text-foreground ${
            detailed ? "text-xl" : "text-lg"
          }`}
        >
          {courseTitle}
        </p>

        <div className="mx-auto my-4 h-px w-16 bg-card-border" />

        <p className="text-sm text-muted">{formatDate(issueDate)}</p>

        {detailed && (
          <div className="mt-6 space-y-2 text-left">
            <div className="flex items-start gap-2 text-sm">
              <span className="w-28 shrink-0 font-medium text-muted">
                Token ID
              </span>
              <span className="font-mono text-foreground">{tokenId}</span>
            </div>
            <div className="flex items-start gap-2 text-sm">
              <span className="w-28 shrink-0 font-medium text-muted">
                Recipient
              </span>
              <span
                className="break-all font-mono text-foreground"
                title={owner}
              >
                {truncateAddress(owner)}
              </span>
            </div>
            <div className="flex items-start gap-2 text-sm">
              <span className="w-28 shrink-0 font-medium text-muted">
                Contract
              </span>
              <span
                className="break-all font-mono text-foreground"
                title={contractAddress}
              >
                {truncateAddress(contractAddress)}
              </span>
            </div>
          </div>
        )}

        {!detailed && (
          <p className="mt-3 font-mono text-xs text-muted">
            Token #{tokenId}
          </p>
        )}
      </div>
    </div>
  );
}
