"use client";

import Link from "next/link";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { usePathname } from "next/navigation";
import { Suspense } from "react";

function NavLinks() {
  const pathname = usePathname();

  const links = [
    { href: "/verify", label: "Verify" },
    { href: "/dashboard", label: "Dashboard" },
  ];

  return (
    <nav className="hidden items-center gap-1 sm:flex" aria-label="Main navigation">
      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
            pathname === link.href || pathname?.startsWith(link.href + "/")
              ? "bg-accent/10 text-accent"
              : "text-muted hover:text-foreground hover:bg-card-border/50"
          }`}
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}

export default function Header() {
  return (
    <header className="border-b border-card-border bg-card no-print">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-8">
          <Link
            href="/"
            className="flex items-center gap-2 text-lg font-bold tracking-tight text-foreground"
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              className="text-accent"
              aria-hidden="true"
            >
              <path
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            CertChain
          </Link>
          <Suspense
            fallback={
              <nav className="hidden items-center gap-1 sm:flex" aria-label="Main navigation">
                <span className="rounded-md px-3 py-2 text-sm font-medium text-muted">Verify</span>
                <span className="rounded-md px-3 py-2 text-sm font-medium text-muted">Dashboard</span>
              </nav>
            }
          >
            <NavLinks />
          </Suspense>
        </div>
        <ConnectButton
          showBalance={false}
          chainStatus="icon"
          accountStatus={{ smallScreen: "avatar", largeScreen: "address" }}
        />
      </div>
    </header>
  );
}
