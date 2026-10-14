import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-24">
      <div className="mx-auto max-w-2xl text-center">
        <h1 className="text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 sm:text-5xl">
          On-Chain Certificate Issuer
        </h1>
        <p className="mt-6 text-lg leading-8 text-zinc-600 dark:text-zinc-400">
          Issue, verify, and manage soulbound ERC-721 certificates of
          completion. Every certificate is permanently recorded on-chain with a
          unique SVG image, making credentials tamper-proof and publicly
          verifiable.
        </p>
        <div className="mt-10 flex items-center justify-center gap-4">
          <Link
            href="/verify"
            className="rounded-full bg-amber-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-amber-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600"
          >
            Verify a Certificate
          </Link>
          <Link
            href="/dashboard"
            className="rounded-full border border-zinc-300 px-6 py-3 text-sm font-semibold text-zinc-900 shadow-sm transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-800"
          >
            Institution Dashboard
          </Link>
        </div>
      </div>

      <div className="mx-auto mt-20 grid max-w-4xl grid-cols-1 gap-8 sm:grid-cols-3">
        <div className="rounded-xl border border-zinc-200 p-6 dark:border-zinc-800">
          <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
            Soulbound
          </h3>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Certificates are non-transferable. They permanently belong to the
            recipient who earned them.
          </p>
        </div>
        <div className="rounded-xl border border-zinc-200 p-6 dark:border-zinc-800">
          <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
            On-Chain SVG
          </h3>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Each certificate includes a generated SVG image stored entirely
            on-chain. No external dependencies.
          </p>
        </div>
        <div className="rounded-xl border border-zinc-200 p-6 dark:border-zinc-800">
          <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
            Publicly Verifiable
          </h3>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Anyone can verify a certificate&apos;s authenticity using its token
            ID. Valid, revoked, and nonexistent states are clearly
            distinguished.
          </p>
        </div>
      </div>
    </div>
  );
}
