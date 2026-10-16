"use client";

import { useAccount, useReadContract, useChainId } from "wagmi";
import { certificateContract, CertificateStatus } from "@/lib/contracts";
import { CONTRACT_ADDRESS } from "@/lib/config";
import IssueCertificateForm from "@/components/IssueCertificateForm";
import RevokeCertificateForm from "@/components/RevokeCertificateForm";
import { useState } from "react";
import Link from "next/link";

function truncateAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function StatusBadge({ connected, label }: { connected: boolean; label: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
        connected
          ? "bg-success/10 text-success"
          : "bg-muted/10 text-muted"
      }`}
    >
      <span
        className={`inline-block h-1.5 w-1.5 rounded-full ${
          connected ? "bg-success" : "bg-muted"
        }`}
      />
      {label}
    </span>
  );
}

/** Displays a compact list of recently issued certificates. */
function RecentCertificates({ count }: { count: number }) {
  if (count === 0) return null;

  // Show links to the last few certificates
  const ids = Array.from({ length: Math.min(count, 10) }, (_, i) => count - 1 - i);

  return (
    <div className="rounded-xl border border-card-border bg-card p-6">
      <h2 className="text-lg font-semibold text-foreground">
        Recent Certificates
      </h2>
      <p className="mt-1 text-sm text-muted">
        {count} certificate{count !== 1 ? "s" : ""} issued total.
      </p>
      <div className="mt-4 space-y-2">
        {ids.map((id) => (
          <RecentCertRow key={id} tokenId={id} />
        ))}
      </div>
    </div>
  );
}

function RecentCertRow({ tokenId }: { tokenId: number }) {
  const { data: result } = useReadContract({
    ...certificateContract,
    functionName: "verifyCertificate",
    args: [BigInt(tokenId)],
  });

  if (!result) {
    return (
      <div className="flex items-center justify-between rounded-lg border border-card-border bg-background px-4 py-3">
        <span className="font-mono text-sm text-muted">#{tokenId}</span>
        <span className="text-xs text-muted">Loading...</span>
      </div>
    );
  }

  const isRevoked = result.status === CertificateStatus.Revoked;

  return (
    <Link
      href={`/verify/${tokenId}`}
      className="flex items-center justify-between rounded-lg border border-card-border bg-background px-4 py-3 transition-colors hover:bg-card-border/30"
    >
      <div className="min-w-0">
        <span className="font-mono text-sm text-foreground">#{tokenId}</span>
        <span className="ml-2 text-sm text-muted truncate">
          {result.recipientName}
        </span>
      </div>
      <span
        className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
          isRevoked
            ? "bg-destructive/10 text-destructive"
            : "bg-success/10 text-success"
        }`}
      >
        {isRevoked ? "Revoked" : "Valid"}
      </span>
    </Link>
  );
}

export default function DashboardPage() {
  const { address, isConnected, chain } = useAccount();
  const chainId = useChainId();
  const [refreshKey, setRefreshKey] = useState(0);

  const { data: contractOwner, isLoading: ownerLoading } = useReadContract({
    ...certificateContract,
    functionName: "owner",
  });

  const { data: totalIssued } = useReadContract({
    ...certificateContract,
    functionName: "totalIssued",
    query: { refetchInterval: 10_000 },
  });

  const isOwner =
    isConnected &&
    address &&
    contractOwner &&
    address.toLowerCase() === (contractOwner as string).toLowerCase();

  const handleSuccess = () => setRefreshKey((k) => k + 1);

  // Not connected
  if (!isConnected) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Institution Dashboard
        </h1>
        <p className="mt-4 text-muted">
          Connect your wallet to access the dashboard. Only the contract owner
          can issue and revoke certificates.
        </p>
        <div className="mt-6 rounded-xl border border-card-border bg-card p-6">
          <p className="text-sm text-muted">
            Wallet not connected. Use the connect button in the header.
          </p>
        </div>
      </div>
    );
  }

  // Loading owner
  if (ownerLoading) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Institution Dashboard
        </h1>
        <p className="mt-4 text-muted">
          Checking authorization...
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10" key={refreshKey}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Institution Dashboard
        </h1>
        <div className="flex flex-wrap gap-2">
          <StatusBadge connected={isConnected} label={chain?.name ?? "Unknown"} />
          <StatusBadge
            connected={!!isOwner}
            label={isOwner ? "Authorized" : "Not Authorized"}
          />
        </div>
      </div>

      {/* Connection info */}
      <div className="mt-6 rounded-xl border border-card-border bg-card p-4">
        <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
          <div>
            <dt className="font-medium text-muted">Connected Wallet</dt>
            <dd className="mt-0.5 font-mono text-foreground" title={address}>
              {address ? truncateAddress(address) : "—"}
            </dd>
          </div>
          <div>
            <dt className="font-medium text-muted">Network</dt>
            <dd className="mt-0.5 text-foreground">
              {chain?.name ?? "Unknown"} (Chain ID: {chainId})
            </dd>
          </div>
          <div>
            <dt className="font-medium text-muted">Contract</dt>
            <dd
              className="mt-0.5 font-mono text-foreground"
              title={CONTRACT_ADDRESS}
            >
              {truncateAddress(CONTRACT_ADDRESS)}
            </dd>
          </div>
        </dl>
      </div>

      {/* Not authorized */}
      {!isOwner && (
        <div className="mt-6 rounded-xl border border-warning/30 bg-warning/5 p-6">
          <p className="text-sm text-warning">
            Your connected wallet is not the contract owner. Only the
            institution address can issue and revoke certificates.
          </p>
          {contractOwner && (
            <p className="mt-2 text-xs text-muted">
              Contract owner:{" "}
              <span className="font-mono">{contractOwner as string}</span>
            </p>
          )}
          <p className="mt-2 text-xs text-muted">
            The contract enforces permissions on-chain. Hiding UI controls is
            not a security measure.
          </p>
        </div>
      )}

      {/* Authorized issuer controls */}
      {isOwner && (
        <>
          <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-2">
            <div className="rounded-xl border border-card-border bg-card p-6">
              <h2 className="text-lg font-semibold text-foreground">
                Issue Certificate
              </h2>
              <p className="mt-1 mb-6 text-sm text-muted">
                Mint a new soulbound certificate to a recipient wallet.
              </p>
              <IssueCertificateForm onSuccess={handleSuccess} />
            </div>

            <div className="space-y-8">
              <div className="rounded-xl border border-card-border bg-card p-6">
                <h2 className="text-lg font-semibold text-foreground">
                  Revoke Certificate
                </h2>
                <p className="mt-1 mb-6 text-sm text-muted">
                  Invalidate an existing certificate by token ID.
                </p>
                <RevokeCertificateForm onSuccess={handleSuccess} />
              </div>

              <div className="rounded-xl border border-card-border bg-card p-6">
                <h2 className="text-lg font-semibold text-foreground">
                  Verify Certificate
                </h2>
                <p className="mt-1 mb-4 text-sm text-muted">
                  Look up any certificate by token ID.
                </p>
                <Link
                  href="/verify"
                  className="inline-flex items-center rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover"
                >
                  Go to Verification
                </Link>
              </div>
            </div>
          </div>

          {/* Recent certificates */}
          {typeof totalIssued === "bigint" && totalIssued > 0n && (
            <div className="mt-8">
              <RecentCertificates count={Number(totalIssued)} />
            </div>
          )}
        </>
      )}
    </div>
  );
}
