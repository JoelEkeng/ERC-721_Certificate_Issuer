"use client";

import { useState } from "react";
import {
  useWriteContract,
  useWaitForTransactionReceipt,
  useAccount,
} from "wagmi";
import { certificateIssuerAbi } from "@/lib/abi";
import { CONTRACT_ADDRESS } from "@/lib/config";

export default function RevokeCertificateForm({
  onSuccess,
}: {
  onSuccess?: () => void;
}) {
  const { isConnected } = useAccount();
  const [tokenIdInput, setTokenIdInput] = useState("");
  const [validationError, setValidationError] = useState("");

  const {
    writeContract,
    data: txHash,
    isPending: isWriting,
    error: writeError,
    reset,
  } = useWriteContract();

  const { isLoading: isConfirming, isSuccess: isConfirmed } =
    useWaitForTransactionReceipt({
      hash: txHash,
    });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError("");
    reset();

    const parsed = Number(tokenIdInput);
    if (isNaN(parsed) || parsed < 0 || !Number.isInteger(parsed)) {
      setValidationError("Please enter a valid non-negative integer token ID.");
      return;
    }

    writeContract({
      address: CONTRACT_ADDRESS,
      abi: certificateIssuerAbi,
      functionName: "revoke",
      args: [BigInt(parsed)],
    });
  };

  if (isConfirmed && txHash) {
    setTimeout(() => {
      setTokenIdInput("");
      reset();
      onSuccess?.();
    }, 0);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Token ID to Revoke
        </label>
        <input
          type="number"
          min="0"
          step="1"
          placeholder="0"
          value={tokenIdInput}
          onChange={(e) => setTokenIdInput(e.target.value)}
          className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder-zinc-500"
        />
      </div>

      {validationError && (
        <p className="text-sm text-red-600 dark:text-red-400">{validationError}</p>
      )}
      {writeError && (
        <p className="text-sm text-red-600 dark:text-red-400">
          Revocation failed: {writeError.message.split("\n")[0]}
        </p>
      )}
      {isConfirming && (
        <p className="text-sm text-amber-600 dark:text-amber-400">
          Waiting for confirmation...
        </p>
      )}
      {isConfirmed && (
        <p className="text-sm text-green-600 dark:text-green-400">
          Certificate revoked successfully!
        </p>
      )}

      <button
        type="submit"
        disabled={!isConnected || isWriting || isConfirming}
        className="w-full rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isWriting
          ? "Confirm in wallet..."
          : isConfirming
            ? "Confirming..."
            : "Revoke Certificate"}
      </button>
    </form>
  );
}
