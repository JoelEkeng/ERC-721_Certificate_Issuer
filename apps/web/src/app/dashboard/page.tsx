"use client";

import { useAccount, useReadContract } from "wagmi";
import { certificateIssuerAbi } from "@/lib/abi";
import { CONTRACT_ADDRESS } from "@/lib/config";
import IssueCertificateForm from "@/components/IssueCertificateForm";
import RevokeCertificateForm from "@/components/RevokeCertificateForm";
import { useState } from "react";

export default function DashboardPage() {
  const { address, isConnected } = useAccount();
  const [refreshKey, setRefreshKey] = useState(0);

  const { data: contractOwner } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: certificateIssuerAbi,
    functionName: "owner",
  });

  const isOwner =
    isConnected &&
    address &&
    contractOwner &&
    address.toLowerCase() === (contractOwner as string).toLowerCase();

  const handleSuccess = () => setRefreshKey((k) => k + 1);

  if (!isConnected) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
          Institution Dashboard
        </h1>
        <p className="mt-4 text-zinc-600 dark:text-zinc-400">
          Connect your wallet to access the dashboard. Only the contract owner
          (institution) can issue and revoke certificates.
        </p>
      </div>
    );
  }

  if (!isOwner) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
          Institution Dashboard
        </h1>
        <div className="mt-6 rounded-lg border border-amber-300 bg-amber-50 p-6 dark:border-amber-800 dark:bg-amber-950">
          <p className="text-sm text-amber-800 dark:text-amber-300">
            Your connected wallet ({address}) is not the contract owner. Only
            the institution address can issue and revoke certificates.
          </p>
          {contractOwner && (
            <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
              Contract owner: <span className="font-mono">{contractOwner as string}</span>
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-16" key={refreshKey}>
      <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
        Institution Dashboard
      </h1>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        Connected as contract owner. You can issue new certificates and revoke
        existing ones.
      </p>

      <div className="mt-10 grid grid-cols-1 gap-8 md:grid-cols-2">
        <div className="rounded-xl border border-zinc-200 p-6 dark:border-zinc-800">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            Issue Certificate
          </h2>
          <p className="mt-1 mb-6 text-sm text-zinc-500">
            Mint a new soulbound certificate to a recipient.
          </p>
          <IssueCertificateForm onSuccess={handleSuccess} />
        </div>

        <div className="rounded-xl border border-zinc-200 p-6 dark:border-zinc-800">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            Revoke Certificate
          </h2>
          <p className="mt-1 mb-6 text-sm text-zinc-500">
            Invalidate an existing certificate by its token ID.
          </p>
          <RevokeCertificateForm onSuccess={handleSuccess} />
        </div>
      </div>
    </div>
  );
}
