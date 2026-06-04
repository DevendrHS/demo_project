"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useWalletStore } from "@/lib/store";

export default function CreatorCampaignsPage() {
  const { address, token } = useWalletStore();

  const { data, isLoading } = useQuery({
    queryKey: ["campaigns"],
    queryFn: () => api("/campaigns"),
  });

  const mine = (data?.campaigns || []).filter(
    (c) => c.ownerWallet?.toLowerCase() === address?.toLowerCase()
  );

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold">My campaigns</h1>
        <Link href="/creator/campaigns/new" className="btn-primary">
          New campaign
        </Link>
      </div>

      {!token && (
        <p className="mb-4 text-sm text-[var(--muted)]">Connect wallet and sign in to manage campaigns.</p>
      )}

      {isLoading && <p>Loading…</p>}
      <div className="space-y-3">
        {mine.map((c) => (
          <div key={c.id} className="card flex items-center justify-between">
            <div>
              <h3 className="font-medium">{c.name}</h3>
              <p className="text-sm capitalize text-[var(--muted)]">{c.status}</p>
            </div>
            <Link href={`/creator/campaigns/${c.id}/edit`} className="btn-ghost text-sm">
              Edit
            </Link>
          </div>
        ))}
        {!isLoading && !mine.length && (
          <p className="text-[var(--muted)]">No campaigns yet.</p>
        )}
      </div>
    </div>
  );
}
