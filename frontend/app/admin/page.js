"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AdminModerationTable } from "@/components/AdminModerationTable";
import { api } from "@/lib/api";

export default function AdminPage() {
  const [wallet, setWallet] = useState("");
  const [reason, setReason] = useState("");

  const analytics = useQuery({
    queryKey: ["admin-analytics"],
    queryFn: () => api("/admin/analytics"),
  });

  async function addBlacklist(e) {
    e.preventDefault();
    try {
      await api("/admin/blacklist", {
        method: "POST",
        body: JSON.stringify({ walletAddress: wallet, reason }),
      });
      alert("Address blacklisted");
      setWallet("");
    } catch (err) {
      alert(err.message);
    }
  }

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold">Admin</h1>

      {analytics.data && (
        <div className="grid gap-4 md:grid-cols-4">
          {[
            ["Campaigns", analytics.data.campaigns],
            ["Claims", analytics.data.claims],
            ["Unique claimers", analytics.data.uniqueClaimers],
            ["Users", analytics.data.users],
          ].map(([label, value]) => (
            <div key={label} className="card text-center">
              <p className="text-2xl font-bold">{value}</p>
              <p className="text-sm text-[var(--muted)]">{label}</p>
            </div>
          ))}
        </div>
      )}

      <section className="card">
        <h2 className="mb-4 font-semibold">Pending moderation</h2>
        <AdminModerationTable />
      </section>

      <section className="card">
        <h2 className="mb-4 font-semibold">Blacklist wallet</h2>
        <form onSubmit={addBlacklist} className="flex flex-wrap gap-2">
          <input
            className="input flex-1"
            placeholder="0x…"
            value={wallet}
            onChange={(e) => setWallet(e.target.value)}
          />
          <input
            className="input flex-1"
            placeholder="Reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <button type="submit" className="btn-primary">
            Add
          </button>
        </form>
      </section>
    </div>
  );
}
