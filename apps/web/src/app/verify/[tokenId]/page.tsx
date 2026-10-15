import { Suspense } from "react";
import CertificateDetailView from "./CertificateDetailView";

export const instant = false;

export default async function CertificateDetailPage({
  params,
}: {
  params: Promise<{ tokenId: string }>;
}) {
  const { tokenId } = await params;

  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-2xl px-4 py-16 text-center">
          <h1 className="text-2xl font-bold text-foreground">
            Certificate #{tokenId}
          </h1>
          <p className="mt-4 text-muted">Loading...</p>
        </div>
      }
    >
      <CertificateDetailView tokenId={tokenId} />
    </Suspense>
  );
}
