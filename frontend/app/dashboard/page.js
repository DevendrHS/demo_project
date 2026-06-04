"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useWalletStore } from "@/lib/store";
import Link from "next/link";

export default function DashboardPage() {
  const { address, token } = useWalletStore();

  const claims = useQuery({
    queryKey: ["my-claims"],
    queryFn: () => api("/users/me/claims"),
    enabled: !!token,
  });

  const eligible = useQuery({
    queryKey: ["my-eligible"],
    queryFn: () => api("/users/me/eligible"),
    enabled: !!token,
  });

  if (!address) {
    return (
      <div className="card">
        <p>Connect your wallet to view claim history and eligible campaigns.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold">Dashboard</h1>

      <section className="card">
        <h2 className="mb-4 font-semibold">Eligible campaigns</h2>
        {eligible.isLoading && <p>Loading…</p>}
        <ul className="space-y-2">
          {(eligible.data?.campaigns || []).map((c) => (
            <li key={c.id}>
              <Link href={`/campaign/${c.id}`} className="text-brand-500 hover:underline">
                {c.name}
              </Link>
            </li>
          ))}
          {!eligible.isLoading && !(eligible.data?.campaigns || []).length && (
            <p className="text-sm text-[var(--muted)]">No eligible campaigns right now.</p>
          )}
        </ul>
      </section>

      <section className="card">
        <h2 className="mb-4 font-semibold">Claim history</h2>
        {claims.isLoading && <p>Loading…</p>}
        {claims.error && (
          <p className="text-sm text-red-400">{claims.error.message}</p>
        )}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-[var(--muted)]">
                <th className="py-2 text-left">Campaign</th>
                <th className="py-2 text-left">Tx</th>
                <th className="py-2 text-left">Status</th>
              </tr>
            </thead>
            <tbody>
              {(claims.data?.claims || []).map((row) => (
                <tr key={row.id} className="border-b border-white/5">
                  <td className="py-2">{row.campaign_name}</td>
                  <td className="py-2 font-mono text-xs">
                    {row.transaction_hash?.slice(0, 14)}…
                  </td>
                  <td className="py-2 capitalize">{row.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
