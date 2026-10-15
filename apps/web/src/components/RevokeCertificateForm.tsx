"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  useWriteContract,
  useWaitForTransactionReceipt,
  useAccount,
  useChainId,
  useReadContract,
} from "wagmi";
import { certificateContract, CertificateStatus } from "@/lib/contracts";
import { revokeSchema, type RevokeInput } from "@/lib/validation";
import { translateError } from "@/lib/errors";
import { getTxUrl } from "@/lib/explorer";

export default function RevokeCertificateForm({
  onSuccess,
}: {
  onSuccess?: () => void;
}) {
  const { isConnected } = useAccount();
  const chainId = useChainId();
  const [lookupId, setLookupId] = useState<bigint | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    reset: resetForm,
    formState: { errors, isValid },
  } = useForm<RevokeInput>({
    resolver: zodResolver(revokeSchema),
    mode: "onChange",
    defaultValues: { tokenId: "" },
  });

  const tokenIdValue = watch("tokenId");

  // Look up the certificate before revoking
  const { data: verifyResult } = useReadContract({
    ...certificateContract,
    functionName: "verifyCertificate",
    args: lookupId !== null ? [lookupId] : undefined,
    query: { enabled: lookupId !== null },
  });

  const certStatus = verifyResult?.status;

  const {
    writeContract,
    data: txHash,
    isPending: isWriting,
    error: writeError,
    reset: resetWrite,
  } = useWriteContract();

  const { isLoading: isConfirming, isSuccess: isConfirmed, error: receiptError } =
    useWaitForTransactionReceipt({ hash: txHash });

  useEffect(() => {
    if (isConfirmed) onSuccess?.();
  }, [isConfirmed, onSuccess]);

  // Update lookup when input changes
  useEffect(() => {
    if (/^\d+$/.test(tokenIdValue) && Number(tokenIdValue) >= 0) {
      setLookupId(BigInt(tokenIdValue));
    } else {
      setLookupId(null);
    }
  }, [tokenIdValue]);

  const onSubmit = (data: RevokeInput) => {
    resetWrite();
    writeContract({
      ...certificateContract,
      functionName: "revoke",
      args: [BigInt(data.tokenId)],
    });
  };

  const handleReset = () => {
    resetForm();
    resetWrite();
    setLookupId(null);
  };

  const txUrl = txHash ? getTxUrl(chainId, txHash) : null;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <label
          htmlFor="revokeTokenId"
          className="block text-sm font-medium text-foreground"
        >
          Token ID to Revoke
        </label>
        <input
          id="revokeTokenId"
          type="text"
          inputMode="numeric"
          placeholder="0"
          {...register("tokenId")}
          className="mt-1 w-full rounded-lg border border-card-border bg-background px-3 py-2.5 text-sm text-foreground placeholder-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          aria-describedby={errors.tokenId ? "revoke-error" : undefined}
        />
        {errors.tokenId && (
          <p id="revoke-error" className="mt-1 text-sm text-destructive">
            {errors.tokenId.message}
          </p>
        )}
      </div>

      {/* Certificate status preview */}
      {lookupId !== null && certStatus !== undefined && (
        <div
          className={`rounded-lg border p-3 text-sm ${
            certStatus === CertificateStatus.Valid
              ? "border-success/30 bg-success/5 text-success"
              : certStatus === CertificateStatus.Revoked
                ? "border-warning/30 bg-warning/5 text-warning"
                : "border-card-border bg-card text-muted"
          }`}
        >
          {certStatus === CertificateStatus.Valid && (
            <>
              Certificate #{tokenIdValue} is currently{" "}
              <strong>valid</strong>. Revoking will mark it as invalid.
              {verifyResult?.recipientName && (
                <span className="block mt-1">
                  Recipient: {verifyResult.recipientName}
                </span>
              )}
            </>
          )}
          {certStatus === CertificateStatus.Revoked && (
            <>Certificate #{tokenIdValue} is already <strong>revoked</strong>.</>
          )}
          {certStatus === CertificateStatus.Nonexistent && (
            <>Certificate #{tokenIdValue} does not exist.</>
          )}
        </div>
      )}

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
            Revocation failed on-chain. {translateError(receiptError)}
          </p>
        </div>
      )}

      {txHash && isConfirming && (
        <div className="rounded-lg border border-accent/30 bg-accent/5 p-3">
          <p className="text-sm text-accent">
            Waiting for confirmation...
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
        </div>
      )}

      {isConfirmed && (
        <div className="rounded-lg border border-success/30 bg-success/5 p-3">
          <p className="font-semibold text-success">
            Certificate revoked successfully.
          </p>
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
            className="mt-2 text-sm text-accent underline hover:text-accent-hover"
          >
            Revoke another
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
            certStatus !== CertificateStatus.Valid
          }
          className="w-full rounded-lg bg-destructive px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-destructive/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isWriting
            ? "Confirm in wallet..."
            : isConfirming
              ? "Confirming..."
              : "Revoke Certificate"}
        </button>
      )}
    </form>
  );
}
