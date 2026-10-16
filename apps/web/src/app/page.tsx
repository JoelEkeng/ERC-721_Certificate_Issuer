import Link from "next/link";

const features = [
  {
    title: "Immutable Certificates",
    description:
      "Each certificate is minted as a unique ERC-721 token on the blockchain. Once issued, the recipient name, course title, and date cannot be altered by anyone.",
  },
  {
    title: "Soulbound Tokens",
    description:
      "Certificates are permanently bound to the recipient's wallet. They cannot be transferred, sold, or traded, ensuring credentials remain with the person who earned them.",
  },
  {
    title: "Public Verification",
    description:
      "Anyone can verify a certificate's authenticity using its token ID. The contract clearly distinguishes valid, revoked, and nonexistent certificates.",
  },
  {
    title: "Institutional Control",
    description:
      "Only the authorized institution can issue and revoke certificates. Revocation preserves the historical record while marking the credential as invalidated.",
  },
  {
    title: "On-Chain SVG Image",
    description:
      "Each certificate includes a generated SVG image stored entirely on-chain. No external hosting, no broken links, no dependencies.",
  },
  {
    title: "Transparent & Public",
    description:
      "All certificate data is publicly visible on the blockchain. Recipient names and course titles are permanently recorded and readable by anyone.",
  },
];

export default function Home() {
  return (
    <div className="flex flex-col">
      {/* Hero */}
      <section className="px-4 py-20 sm:py-28">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
            On-Chain Certificate Verification
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-muted">
            A blockchain-powered platform for issuing tamper-proof, publicly
            verifiable certificates of completion. Every credential is
            permanently recorded on-chain as a soulbound token.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              href="/verify"
              className="inline-flex items-center rounded-lg bg-accent px-6 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              Verify a Certificate
            </Link>
            <Link
              href="/dashboard"
              className="inline-flex items-center rounded-lg border border-card-border bg-card px-6 py-3 text-sm font-semibold text-foreground shadow-sm transition-colors hover:bg-card-border/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              Institution Dashboard
            </Link>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="border-t border-card-border bg-card px-4 py-16 sm:py-20">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-center text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            How It Works
          </h2>
          <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <div
                key={f.title}
                className="rounded-xl border border-card-border bg-background p-6"
              >
                <h3 className="text-base font-semibold text-foreground">
                  {f.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">
                  {f.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Important notice */}
      <section className="border-t border-card-border px-4 py-12">
        <div className="mx-auto max-w-3xl rounded-xl border border-card-border bg-card p-6 sm:p-8">
          <h3 className="text-lg font-semibold text-foreground">
            Important Information
          </h3>
          <ul className="mt-4 space-y-3 text-sm leading-relaxed text-muted">
            <li>
              <strong className="text-foreground">Public data:</strong>{" "}
              Recipient names, course titles, and wallet addresses are
              permanently stored on the public blockchain. This information
              cannot be deleted.
            </li>
            <li>
              <strong className="text-foreground">Revocation:</strong>{" "}
              Institutions can revoke certificates, which marks them as invalid.
              The original data remains visible but clearly flagged as revoked.
            </li>
            <li>
              <strong className="text-foreground">Verification:</strong>{" "}
              Always verify certificates on-chain using the contract directly or
              this application. Screenshots or downloaded images are not proof
              of authenticity.
            </li>
            <li>
              <strong className="text-foreground">Gas fees:</strong>{" "}
              Issuing certificates requires an on-chain transaction and
              associated gas fees paid by the institution.
            </li>
          </ul>
        </div>
      </section>
    </div>
  );
}
