"use client";

import Link from "next/link";
import { WalletConnector } from "./WalletConnector";

const links = [
  { href: "/", label: "Campaigns" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/creator/campaigns", label: "Creator" },
  { href: "/admin", label: "Admin" },
];

export function Nav() {
  return (
    <header className="border-b border-white/10 bg-black/40">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
        <Link href="/" className="text-lg font-bold text-brand-500">
          AirdropHub
        </Link>
        <nav className="hidden gap-6 md:flex">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="text-sm text-[var(--muted)] hover:text-white"
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <WalletConnector />
      </div>
    </header>
  );
}
