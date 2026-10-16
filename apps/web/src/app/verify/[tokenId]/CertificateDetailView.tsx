"use client";

import { useReadContract, useChainId } from "wagmi";
import { certificateContract, CertificateStatus, getStatusLabel } from "@/lib/contracts";
import { CONTRACT_ADDRESS } from "@/lib/config";
import { getAddressUrl, getTokenUrl } from "@/lib/explorer";
import CertificateCard from "@/components/CertificateCard";
import Link from "next/link";

function formatDate(timestamp: bigint): string {
  if (timestamp === 0n) return "Unknown";
  const date = new Date(Number(timestamp) * 1000);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default function CertificateDetailView({
  tokenId,
}: {
  tokenId: string;
}) {
  const chainId = useChainId();

  const isValidId = /^\d+$/.test(tokenId);
  const tokenIdBigInt = isValidId ? BigInt(tokenId) : undefined;

  const {
    data: result,
    isLoading,
    isError,
    error,
  } = useReadContract({
    ...certificateContract,
    functionName: "verifyCertificate",
    args: tokenIdBigInt !== undefined ? [tokenIdBigInt] : undefined,
    query: { enabled: tokenIdBigInt !== undefined },
  });

  // Fetch the tokenURI for the on-chain image
  const { data: tokenURI } = useReadContract({
    ...certificateContract,
    functionName: "tokenURI",
    args: tokenIdBigInt !== undefined ? [tokenIdBigInt] : undefined,
    query: {
      enabled:
        tokenIdBigInt !== undefined &&
        result?.status !== undefined &&
        result.status !== CertificateStatus.Nonexistent,
    },
  });

  // Parse the data URI to extract the SVG image
  let svgDataUri: string | null = null;
  if (tokenURI && typeof tokenURI === "string") {
    try {
      const jsonStr = tokenURI.startsWith("data:application/json;base64,")
        ? atob(tokenURI.replace("data:application/json;base64,", ""))
        : null;
      if (jsonStr) {
        const metadata = JSON.parse(jsonStr);
        if (metadata.image) {
          svgDataUri = metadata.image;
        }
      }
    } catch {
      // Ignore parse errors
    }
  }

  const explorerUrl = getAddressUrl(chainId, CONTRACT_ADDRESS);
  const tokenExplorerUrl = getTokenUrl(chainId, CONTRACT_ADDRESS, tokenId);

  if (!isValidId) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-foreground">Invalid Token ID</h1>
        <p className="mt-2 text-muted">
          &quot;{tokenId}&quot; is not a valid token ID.
        </p>
        <Link
          href="/verify"
          className="mt-4 inline-block text-sm text-accent underline hover:text-accent-hover"
        >
          Back to verification
        </Link>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-foreground">
          Certificate #{tokenId}
        </h1>
        <p className="mt-4 text-muted">Verifying on-chain...</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16">
        <h1 className="text-2xl font-bold text-foreground">
          Certificate #{tokenId}
        </h1>
        <div className="mt-6 rounded-xl border border-destructive/30 bg-destructive/5 p-6">
          <p className="font-semibold text-destructive">
            Unable to verify certificate
          </p>
          <p className="mt-1 text-sm text-muted">
            Could not connect to the blockchain network. This does not mean the
            certificate is invalid. Please try again when the network is
            available.
          </p>
          {error && (
            <p className="mt-2 text-xs text-muted">
              {error.message.split("\n")[0]}
            </p>
          )}
        </div>
        <Link
          href="/verify"
          className="mt-4 inline-block text-sm text-accent underline hover:text-accent-hover"
        >
          Back to verification
        </Link>
      </div>
    );
  }

  const certStatus = result?.status;

  // Nonexistent
  if (certStatus === CertificateStatus.Nonexistent) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16">
        <h1 className="text-2xl font-bold text-foreground">
          Certificate #{tokenId}
        </h1>
        <div className="mt-6 rounded-xl border border-card-border bg-card p-6">
          <div className="flex items-center gap-2">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-muted" />
            <span className="text-sm font-semibold text-muted">Not Found</span>
          </div>
          <p className="mt-2 text-sm text-muted">
            No certificate exists for token ID {tokenId}. It may not have been
            issued, or the ID is incorrect.
          </p>
        </div>
        <Link
          href="/verify"
          className="mt-4 inline-block text-sm text-accent underline hover:text-accent-hover"
        >
          Back to verification
        </Link>
      </div>
    );
  }

  // Valid or Revoked
  if (!result) return null;

  const isRevoked = certStatus === CertificateStatus.Revoked;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="mb-4">
        <Link
          href="/verify"
          className="text-sm text-accent hover:text-accent-hover"
        >
          &larr; Back to verification
        </Link>
      </div>

      {/* Certificate card */}
      <CertificateCard
        recipientName={result.recipientName}
        courseTitle={result.courseTitle}
        issueDate={result.issueDate}
        owner={result.owner}
        tokenId={tokenId}
        status={certStatus ?? 0}
        contractAddress={CONTRACT_ADDRESS}
        detailed
      />

      {/* On-chain SVG */}
      {svgDataUri && (
        <div className="mt-6 rounded-xl border border-card-border bg-card p-6">
          <h2 className="mb-4 text-sm font-medium uppercase tracking-wider text-muted">
            On-Chain Certificate Image
          </h2>
          <div className="overflow-hidden rounded-lg border border-card-border bg-white">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={svgDataUri}
              alt={`Certificate for ${result.recipientName} — ${result.courseTitle}`}
              className="w-full"
            />
          </div>
        </div>
      )}

      {/* Details table */}
      <div className="mt-6 rounded-xl border border-card-border bg-card p-6">
        <h2 className="mb-4 text-sm font-medium uppercase tracking-wider text-muted">
          Verification Details
        </h2>
        <dl className="space-y-3 text-sm">
          <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-4">
            <dt className="w-32 shrink-0 font-medium text-muted">Status</dt>
            <dd>
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                  isRevoked
                    ? "bg-destructive/10 text-destructive"
                    : "bg-success/10 text-success"
                }`}
              >
                {getStatusLabel(certStatus ?? 0)}
              </span>
            </dd>
          </div>
          <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-4">
            <dt className="w-32 shrink-0 font-medium text-muted">Token ID</dt>
            <dd className="font-mono text-foreground">{tokenId}</dd>
          </div>
          <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-4">
            <dt className="w-32 shrink-0 font-medium text-muted">Recipient</dt>
            <dd className="text-foreground">{result.recipientName}</dd>
          </div>
          <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-4">
            <dt className="w-32 shrink-0 font-medium text-muted">Course</dt>
            <dd className="text-foreground">{result.courseTitle}</dd>
          </div>
          <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-4">
            <dt className="w-32 shrink-0 font-medium text-muted">Issued</dt>
            <dd className="text-foreground">{formatDate(result.issueDate)}</dd>
          </div>
          <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-4">
            <dt className="w-32 shrink-0 font-medium text-muted">Wallet</dt>
            <dd className="break-all font-mono text-xs text-foreground">
              {result.owner}
            </dd>
          </div>
          <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-4">
            <dt className="w-32 shrink-0 font-medium text-muted">Contract</dt>
            <dd className="break-all font-mono text-xs text-foreground">
              {explorerUrl ? (
                <a
                  href={explorerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent underline hover:text-accent-hover"
                >
                  {CONTRACT_ADDRESS}
                </a>
              ) : (
                CONTRACT_ADDRESS
              )}
            </dd>
          </div>
          <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-4">
            <dt className="w-32 shrink-0 font-medium text-muted">Network</dt>
            <dd className="text-foreground">Chain ID {chainId}</dd>
          </div>
          {tokenExplorerUrl && (
            <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-4">
              <dt className="w-32 shrink-0 font-medium text-muted">Explorer</dt>
              <dd>
                <a
                  href={tokenExplorerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-accent underline hover:text-accent-hover"
                >
                  View on block explorer
                </a>
              </dd>
            </div>
          )}
        </dl>
      </div>

      {/* Disclaimer */}
      <div className="mt-6 rounded-xl border border-card-border bg-card p-4">
        <p className="text-xs leading-relaxed text-muted">
          <strong className="text-foreground">Verification notice:</strong> This
          certificate&apos;s authenticity is verified by reading data directly
          from the smart contract on-chain. A screenshot, PDF, or downloaded
          image of this page is not cryptographic proof of the certificate.
          Always verify by querying the contract at{" "}
          <span className="font-mono">{CONTRACT_ADDRESS}</span> on chain ID{" "}
          {chainId}.
        </p>
      </div>

      {/* Print button */}
      <div className="mt-4 flex justify-end no-print">
        <button
          onClick={() => window.print()}
          className="rounded-lg border border-card-border bg-card px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-card-border/50"
        >
          Print Certificate
        </button>
      </div>
    </div>
  );
}
