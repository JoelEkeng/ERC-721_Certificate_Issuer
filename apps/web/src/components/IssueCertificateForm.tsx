"use client";

import { useState } from "react";
import {
  useWriteContract,
  useWaitForTransactionReceipt,
  useAccount,
} from "wagmi";
import { certificateIssuerAbi } from "@/lib/abi";
import { CONTRACT_ADDRESS } from "@/lib/config";
import { isAddress } from "viem";

export default function IssueCertificateForm({
  onSuccess,
}: {
  onSuccess?: () => void;
}) {
  const { isConnected } = useAccount();
  const [recipient, setRecipient] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [courseTitle, setCourseTitle] = useState("");
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

    if (!isAddress(recipient)) {
      setValidationError("Invalid Ethereum address.");
      return;
    }
    if (!recipientName.trim()) {
      setValidationError("Recipient name is required.");
      return;
    }
    if (!courseTitle.trim()) {
      setValidationError("Course title is required.");
      return;
    }

    writeContract({
      address: CONTRACT_ADDRESS,
      abi: certificateIssuerAbi,
      functionName: "issueCertificate",
      args: [recipient as `0x${string}`, recipientName.trim(), courseTitle.trim()],
    });
  };

  // Reset form after confirmation
  if (isConfirmed && txHash) {
    setTimeout(() => {
      setRecipient("");
      setRecipientName("");
      setCourseTitle("");
      reset();
      onSuccess?.();
    }, 0);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Recipient Address
        </label>
        <input
          type="text"
          placeholder="0x..."
          value={recipient}
          onChange={(e) => setRecipient(e.target.value)}
          className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder-zinc-500"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Recipient Name
        </label>
        <input
          type="text"
          placeholder="Alice Johnson"
          value={recipientName}
          onChange={(e) => setRecipientName(e.target.value)}
          className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder-zinc-500"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Course Title
        </label>
        <input
          type="text"
          placeholder="Solidity 101"
          value={courseTitle}
          onChange={(e) => setCourseTitle(e.target.value)}
          className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder-zinc-500"
        />
      </div>

      {validationError && (
        <p className="text-sm text-red-600 dark:text-red-400">{validationError}</p>
      )}
      {writeError && (
        <p className="text-sm text-red-600 dark:text-red-400">
          Transaction failed: {writeError.message.split("\n")[0]}
        </p>
      )}
      {isConfirming && (
        <p className="text-sm text-amber-600 dark:text-amber-400">
          Waiting for transaction confirmation...
        </p>
      )}
      {isConfirmed && (
        <p className="text-sm text-green-600 dark:text-green-400">
          Certificate issued successfully!
        </p>
      )}

      <button
        type="submit"
        disabled={!isConnected || isWriting || isConfirming}
        className="w-full rounded-lg bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-amber-500 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isWriting
          ? "Confirm in wallet..."
          : isConfirming
            ? "Confirming..."
            : "Issue Certificate"}
      </button>
    </form>
  );
}
