"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { verifySchema, type VerifyInput } from "@/lib/validation";
import { useReadContract } from "wagmi";
import { certificateContract, CertificateStatus } from "@/lib/contracts";
import { CONTRACT_ADDRESS } from "@/lib/config";
import CertificateCard from "@/components/CertificateCard";
import Link from "next/link";

export default function VerifyPage() {
  const [lookupId, setLookupId] = useState<bigint | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<VerifyInput>({
    resolver: zodResolver(verifySchema),
    mode: "onSubmit",
    defaultValues: { tokenId: "" },
  });

  const {
    data: result,
    isLoading,
    isError,
    error,
  } = useReadContract({
    ...certificateContract,
    functionName: "verifyCertificate",
    args: lookupId !== null ? [lookupId] : undefined,
    query: { enabled: lookupId !== null },
  });

  const onSubmit = (data: VerifyInput) => {
    setLookupId(BigInt(data.tokenId));
  };

  const certStatus = result?.status;

  return (
    <div className="mx-auto max-w-xl px-4 py-16">
      <h1 className="text-3xl font-bold tracking-tight text-foreground">
        Verify Certificate
      </h1>
      <p className="mt-2 text-sm text-muted">
        Enter a certificate token ID to check its authenticity and status
        directly from the blockchain.
      </p>

      <form onSubmit={handleSubmit(onSubmit)} className="mt-8 flex gap-3">
        <div className="flex-1">
          <label htmlFor="verifyTokenId" className="sr-only">
            Token ID
          </label>
          <input
            id="verifyTokenId"
            type="text"
            inputMode="numeric"
            placeholder="Token ID (e.g. 0)"
            {...register("tokenId")}
            className="w-full rounded-lg border border-card-border bg-background px-4 py-2.5 text-sm text-foreground placeholder-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            aria-describedby={errors.tokenId ? "verify-error" : undefined}
          />
          {errors.tokenId && (
            <p id="verify-error" className="mt-1 text-sm text-destructive">
              {errors.tokenId.message}
            </p>
          )}
        </div>
        <button
          type="submit"
          className="rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent-hover disabled:opacity-50"
        >
          Verify
        </button>
      </form>

      {/* Loading */}
      {lookupId !== null && isLoading && (
        <div className="mt-8 rounded-xl border border-card-border bg-card p-6 text-center">
          <p className="text-sm text-muted">Checking on-chain status...</p>
        </div>
      )}

      {/* Network error */}
      {lookupId !== null && isError && (
        <div className="mt-8 rounded-xl border border-destructive/30 bg-destructive/5 p-6">
          <p className="font-semibold text-destructive">
            Unable to verify certificate
          </p>
          <p className="mt-1 text-sm text-muted">
            Could not connect to the blockchain network. This does not mean the
            certificate is invalid. Please check your network connection and try
            again.
          </p>
          {error && (
            <p className="mt-2 text-xs text-muted">
              {error.message.split("\n")[0]}
            </p>
          )}
        </div>
      )}

      {/* Not found */}
      {lookupId !== null &&
        !isLoading &&
        !isError &&
        certStatus === CertificateStatus.Nonexistent && (
          <div className="mt-8 rounded-xl border border-card-border bg-card p-6">
            <div className="flex items-center gap-2">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-muted" />
              <span className="text-sm font-semibold text-muted">
                Not Found
              </span>
            </div>
            <p className="mt-2 text-sm text-muted">
              No certificate found for token ID {lookupId.toString()}. It may
              not have been issued, or the token ID is incorrect.
            </p>
          </div>
        )}

      {/* Valid or Revoked */}
      {lookupId !== null &&
        !isLoading &&
        !isError &&
        result &&
        (certStatus === CertificateStatus.Valid ||
          certStatus === CertificateStatus.Revoked) && (
          <div className="mt-8 space-y-4">
            <CertificateCard
              recipientName={result.recipientName}
              courseTitle={result.courseTitle}
              issueDate={result.issueDate}
              owner={result.owner}
              tokenId={lookupId.toString()}
              status={certStatus}
              contractAddress={CONTRACT_ADDRESS}
            />
            <div className="flex flex-col gap-2 sm:flex-row">
              <Link
                href={`/verify/${lookupId.toString()}`}
                className="rounded-lg border border-card-border bg-card px-4 py-2 text-center text-sm font-medium text-foreground transition-colors hover:bg-card-border/50"
              >
                View Full Details
              </Link>
            </div>
            <p className="text-xs text-muted">
              This result is read directly from the smart contract at{" "}
              <span className="font-mono">{CONTRACT_ADDRESS}</span>. Screenshots
              or downloaded images are not proof of authenticity.
            </p>
          </div>
        )}
    </div>
  );
}
