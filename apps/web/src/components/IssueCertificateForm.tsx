"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  useWriteContract,
  useWaitForTransactionReceipt,
  useAccount,
  useChainId,
  useSimulateContract,
} from "wagmi";
import { decodeEventLog } from "viem";
import { certificateContract } from "@/lib/contracts";
import {
  issueCertificateSchema,
  type IssueCertificateFormValues,
} from "@/lib/validation";
import { translateError } from "@/lib/errors";
import { getTxUrl } from "@/lib/explorer";
import Link from "next/link";

export default function IssueCertificateForm({
  onSuccess,
}: {
  onSuccess?: () => void;
}) {
  const { isConnected } = useAccount();
  const chainId = useChainId();

  const {
    register,
    handleSubmit,
    watch,
    reset: resetForm,
    formState: { errors, isValid },
  } = useForm<IssueCertificateFormValues>({
    resolver: zodResolver(issueCertificateSchema),
    mode: "onChange",
    defaultValues: { recipient: "", recipientName: "", courseTitle: "" },
  });

  const recipientName = watch("recipientName");
  const courseTitle = watch("courseTitle");
  const recipient = watch("recipient");

  // Simulate the contract call to catch errors early
  const { error: simulateError } = useSimulateContract({
    ...certificateContract,
    functionName: "issueCertificate",
    args: [
      recipient as `0x${string}`,
      recipientName?.trim() || "",
      courseTitle?.trim() || "",
    ],
    query: { enabled: isValid && isConnected },
  });

  const {
    writeContract,
    data: txHash,
    isPending: isWriting,
    error: writeError,
    reset: resetWrite,
  } = useWriteContract();

  const {
    data: receipt,
    isLoading: isConfirming,
    isSuccess: isConfirmed,
    error: receiptError,
  } = useWaitForTransactionReceipt({ hash: txHash });

  // Extract token ID from the receipt logs
  let issuedTokenId: string | null = null;
  if (receipt?.logs) {
    for (const log of receipt.logs) {
      try {
        const decoded = decodeEventLog({
          abi: certificateContract.abi,
          data: log.data,
          topics: log.topics,
        });
        if (decoded.eventName === "CertificateIssued") {
          issuedTokenId = (
            decoded.args as { tokenId: bigint }
          ).tokenId.toString();
          break;
        }
      } catch {
        // Not our event — skip
      }
    }
  }

  // Call onSuccess when confirmed
  useEffect(() => {
    if (isConfirmed) onSuccess?.();
  }, [isConfirmed, onSuccess]);

  const onSubmit = (data: IssueCertificateFormValues) => {
    resetWrite();
    writeContract({
      ...certificateContract,
      functionName: "issueCertificate",
      args: [
        data.recipient as `0x${string}`,
        data.recipientName.trim(),
        data.courseTitle.trim(),
      ],
    });
  };

  const handleReset = () => {
    resetForm();
    resetWrite();
  };

  const txUrl = txHash ? getTxUrl(chainId, txHash) : null;
  const showPreview =
    recipientName?.trim() && courseTitle?.trim() && !isConfirmed;

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label
            htmlFor="recipient"
            className="block text-sm font-medium text-foreground"
          >
            Recipient Wallet Address
          </label>
          <input
            id="recipient"
            type="text"
            placeholder="0x..."
            {...register("recipient")}
            className="mt-1 w-full rounded-lg border border-card-border bg-background px-3 py-2.5 text-sm text-foreground placeholder-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            aria-describedby={errors.recipient ? "recipient-error" : undefined}
          />
          {errors.recipient && (
            <p id="recipient-error" className="mt-1 text-sm text-destructive">
              {errors.recipient.message}
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor="recipientName"
            className="block text-sm font-medium text-foreground"
          >
            Recipient Name
          </label>
          <input
            id="recipientName"
            type="text"
            placeholder="Alice Johnson"
            {...register("recipientName")}
            className="mt-1 w-full rounded-lg border border-card-border bg-background px-3 py-2.5 text-sm text-foreground placeholder-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            aria-describedby={
              errors.recipientName ? "recipientName-error" : undefined
            }
          />
          {errors.recipientName && (
            <p
              id="recipientName-error"
              className="mt-1 text-sm text-destructive"
            >
              {errors.recipientName.message}
            </p>
          )}
          <p className="mt-1 text-xs text-muted">
            {new TextEncoder().encode(recipientName || "").length}/128 bytes
          </p>
        </div>

        <div>
          <label
            htmlFor="courseTitle"
            className="block text-sm font-medium text-foreground"
          >
            Course Title
          </label>
          <input
            id="courseTitle"
            type="text"
            placeholder="Introduction to Blockchain"
            {...register("courseTitle")}
            className="mt-1 w-full rounded-lg border border-card-border bg-background px-3 py-2.5 text-sm text-foreground placeholder-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            aria-describedby={
              errors.courseTitle ? "courseTitle-error" : undefined
            }
          />
          {errors.courseTitle && (
            <p id="courseTitle-error" className="mt-1 text-sm text-destructive">
              {errors.courseTitle.message}
            </p>
          )}
          <p className="mt-1 text-xs text-muted">
            {new TextEncoder().encode(courseTitle || "").length}/256 bytes
          </p>
        </div>

        {/* Privacy warning */}
        <div className="rounded-lg border border-warning/30 bg-warning/5 p-3">
          <p className="text-xs leading-relaxed text-warning">
            <strong>Privacy notice:</strong> Recipient name and course title
            will be permanently and publicly recorded on the blockchain. This
            data cannot be deleted. Ensure you have consent from the recipient.
          </p>
        </div>

        {/* Simulation error */}
        {simulateError && isValid && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
            <p className="text-sm text-destructive">
              {translateError(simulateError)}
            </p>
          </div>
        )}

        {/* Write / receipt errors */}
        {writeError && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
            <p className="text-sm text-destructive">
              {translateError(writeError)}
            </p>
          </div>
        )}
        {receiptError && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
            <p className="text-sm text-destructive">
              Transaction failed on-chain. {translateError(receiptError)}
            </p>
          </div>
        )}

        {/* Pending state */}
        {txHash && isConfirming && (
          <div className="rounded-lg border border-accent/30 bg-accent/5 p-3">
            <p className="text-sm text-accent">
              Transaction submitted. Waiting for confirmation...
            </p>
            {txUrl && (
              <a
                href={txUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 block text-xs text-accent underline"
              >
                View transaction
              </a>
            )}
            <p className="mt-1 font-mono text-xs text-muted break-all">
              {txHash}
            </p>
          </div>
        )}

        {/* Success */}
        {isConfirmed && (
          <div className="rounded-lg border border-success/30 bg-success/5 p-4">
            <p className="font-semibold text-success">
              Certificate issued successfully!
            </p>
            {issuedTokenId !== null && (
              <div className="mt-2 space-y-1">
                <p className="text-sm text-foreground">
                  Token ID:{" "}
                  <span className="font-mono font-semibold">
                    {issuedTokenId}
                  </span>
                </p>
                <Link
                  href={`/verify/${issuedTokenId}`}
                  className="inline-block text-sm text-accent underline hover:text-accent-hover"
                >
                  View certificate
                </Link>
              </div>
            )}
            {txUrl && (
              <a
                href={txUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 block text-xs text-accent underline"
              >
                View on block explorer
              </a>
            )}
            <button
              type="button"
              onClick={handleReset}
              className="mt-3 text-sm text-accent underline hover:text-accent-hover"
            >
              Issue another certificate
            </button>
          </div>
        )}

        {!isConfirmed && (
          <button
            type="submit"
            disabled={
              !isConnected ||
              isWriting ||
              isConfirming ||
              !isValid ||
              !!simulateError
            }
            className="w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isWriting
              ? "Confirm in wallet..."
              : isConfirming
                ? "Confirming..."
                : "Issue Certificate"}
          </button>
        )}
      </form>

      {/* Certificate preview */}
      {showPreview && (
        <div className="rounded-xl border border-card-border bg-card p-6">
          <p className="mb-3 text-xs font-medium uppercase tracking-wider text-muted">
            Certificate Preview
          </p>
          <div className="rounded-lg border border-card-border bg-background p-6 text-center">
            <p className="text-xs uppercase tracking-wider text-muted">
              Certificate of Completion
            </p>
            <p className="mt-3 text-lg font-bold text-foreground">
              {recipientName?.trim()}
            </p>
            <p className="mt-1 text-sm text-muted">has completed</p>
            <p className="mt-1 text-base font-semibold text-foreground">
              {courseTitle?.trim()}
            </p>
            <p className="mt-3 text-xs text-muted">
              {new Date().toLocaleDateString()}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
