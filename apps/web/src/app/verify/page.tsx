"use client";

import { useState } from "react";
import { useReadContract } from "wagmi";
import { certificateIssuerAbi } from "@/lib/abi";
import { CONTRACT_ADDRESS } from "@/lib/config";

// Contract enum: 0 = Nonexistent, 1 = Valid, 2 = Revoked
type CertStatus = "idle" | "loading" | "valid" | "revoked" | "nonexistent" | "error";

export default function VerifyPage() {
  const [tokenIdInput, setTokenIdInput] = useState("");
  const [tokenId, setTokenId] = useState<bigint | null>(null);
  const [status, setStatus] = useState<CertStatus>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  // Single contract call returns the full VerificationResult struct
  const {
    data: verifyResult,
    isError: verifyError,
    isLoading: verifyLoading,
  } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: certificateIssuerAbi,
    functionName: "verifyCertificate",
    args: tokenId !== null ? [tokenId] : undefined,
    query: { enabled: tokenId !== null },
  });

  const handleVerify = () => {
    setErrorMsg("");
    const parsed = Number(tokenIdInput);
    if (isNaN(parsed) || parsed < 0 || !Number.isInteger(parsed)) {
      setStatus("error");
      setErrorMsg("Please enter a valid non-negative integer token ID.");
      return;
    }
    setStatus("loading");
    setTokenId(BigInt(parsed));
  };

  // The contract returns a struct: { status (uint8), owner, recipientName, courseTitle, issueDate }
  const contractStatus = verifyResult?.status;
  const recipientName = verifyResult?.recipientName ?? "";
  const courseTitle = verifyResult?.courseTitle ?? "";
  const issueDate = verifyResult?.issueDate ? Number(verifyResult.issueDate) : 0;
  const ownerAddr = verifyResult?.owner ?? "";

  // Map contract enum to display status
  const derivedStatus: CertStatus =
    tokenId === null
      ? "idle"
      : verifyError
        ? "error"
        : verifyLoading || contractStatus === undefined
          ? "loading"
          : contractStatus === 1
            ? "valid"
            : contractStatus === 2
              ? "revoked"
              : "nonexistent";

  const displayStatus = status === "error" ? "error" : status === "idle" ? "idle" : derivedStatus;

  return (
    <div className="mx-auto max-w-xl px-4 py-16">
      <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
        Verify Certificate
      </h1>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        Enter a certificate token ID to check its authenticity and status.
      </p>

      <div className="mt-8 flex gap-3">
        <input
          type="number"
          min="0"
          step="1"
          placeholder="Token ID (e.g. 0)"
          value={tokenIdInput}
          onChange={(e) => {
            setTokenIdInput(e.target.value);
            setStatus("idle");
            setTokenId(null);
          }}
          onKeyDown={(e) => e.key === "Enter" && handleVerify()}
          className="flex-1 rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm text-zinc-900 placeholder-zinc-400 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder-zinc-500"
        />
        <button
          onClick={handleVerify}
          className="rounded-lg bg-amber-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-amber-500 disabled:opacity-50"
          disabled={!tokenIdInput}
        >
          Verify
        </button>
      </div>

      {displayStatus === "loading" && (
        <div className="mt-8 rounded-lg border border-zinc-200 p-6 dark:border-zinc-800">
          <p className="text-sm text-zinc-500">Checking on-chain status...</p>
        </div>
      )}

      {displayStatus === "error" && (
        <div className="mt-8 rounded-lg border border-red-300 bg-red-50 p-6 dark:border-red-800 dark:bg-red-950">
          <p className="text-sm font-medium text-red-800 dark:text-red-300">
            {errorMsg || "An error occurred while verifying."}
          </p>
        </div>
      )}

      {displayStatus === "nonexistent" && (
        <div className="mt-8 rounded-lg border border-zinc-300 bg-zinc-50 p-6 dark:border-zinc-700 dark:bg-zinc-900">
          <div className="flex items-center gap-2">
            <span className="inline-block h-3 w-3 rounded-full bg-zinc-400" />
            <span className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
              NONEXISTENT
            </span>
          </div>
          <p className="mt-2 text-sm text-zinc-500">
            No certificate found for token ID {tokenIdInput}. It may not have
            been issued yet, or the token ID is incorrect.
          </p>
        </div>
      )}

      {displayStatus === "valid" && (
        <div className="mt-8 rounded-lg border border-green-300 bg-green-50 p-6 dark:border-green-800 dark:bg-green-950">
          <div className="flex items-center gap-2">
            <span className="inline-block h-3 w-3 rounded-full bg-green-500" />
            <span className="text-sm font-semibold text-green-700 dark:text-green-300">
              VALID
            </span>
          </div>
          <dl className="mt-4 space-y-2 text-sm">
            <div>
              <dt className="font-medium text-zinc-600 dark:text-zinc-400">Recipient</dt>
              <dd className="text-zinc-900 dark:text-zinc-100">{recipientName}</dd>
            </div>
            <div>
              <dt className="font-medium text-zinc-600 dark:text-zinc-400">Course</dt>
              <dd className="text-zinc-900 dark:text-zinc-100">{courseTitle}</dd>
            </div>
            <div>
              <dt className="font-medium text-zinc-600 dark:text-zinc-400">Issued</dt>
              <dd className="text-zinc-900 dark:text-zinc-100">
                {issueDate > 0 ? new Date(issueDate * 1000).toLocaleDateString() : "—"}
              </dd>
            </div>
            <div>
              <dt className="font-medium text-zinc-600 dark:text-zinc-400">Owner</dt>
              <dd className="font-mono text-xs text-zinc-900 dark:text-zinc-100 break-all">
                {ownerAddr || "—"}
              </dd>
            </div>
          </dl>
        </div>
      )}

      {displayStatus === "revoked" && (
        <div className="mt-8 rounded-lg border border-red-300 bg-red-50 p-6 dark:border-red-800 dark:bg-red-950">
          <div className="flex items-center gap-2">
            <span className="inline-block h-3 w-3 rounded-full bg-red-500" />
            <span className="text-sm font-semibold text-red-700 dark:text-red-300">
              REVOKED
            </span>
          </div>
          <dl className="mt-4 space-y-2 text-sm">
            <div>
              <dt className="font-medium text-zinc-600 dark:text-zinc-400">Recipient</dt>
              <dd className="text-zinc-900 dark:text-zinc-100">{recipientName}</dd>
            </div>
            <div>
              <dt className="font-medium text-zinc-600 dark:text-zinc-400">Course</dt>
              <dd className="text-zinc-900 dark:text-zinc-100">{courseTitle}</dd>
            </div>
            <div>
              <dt className="font-medium text-zinc-600 dark:text-zinc-400">Issued</dt>
              <dd className="text-zinc-900 dark:text-zinc-100">
                {issueDate > 0 ? new Date(issueDate * 1000).toLocaleDateString() : "—"}
              </dd>
            </div>
            <div>
              <dt className="font-medium text-zinc-600 dark:text-zinc-400">Owner</dt>
              <dd className="font-mono text-xs text-zinc-900 dark:text-zinc-100 break-all">
                {ownerAddr || "—"}
              </dd>
            </div>
          </dl>
          <p className="mt-3 text-sm text-red-600 dark:text-red-400">
            This certificate has been revoked by the issuing institution.
          </p>
        </div>
      )}
    </div>
  );
}
