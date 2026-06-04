"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { CampaignCard } from "@/components/CampaignCard";
import { useState } from "react";

export default function HomePage() {
  const [status, setStatus] = useState("");

  const { data, isLoading, error } = useQuery({
    queryKey: ["campaigns", status],
    queryFn: () =>
      api(`/campaigns${status ? `?status=${status}` : ""}`),
  });

  return (
    <div>
      <h1 className="mb-2 text-3xl font-bold">Campaigns</h1>
      <p className="mb-6 text-[var(--muted)]">
        Browse active NFT airdrops and claim your allocation.
      </p>

      <div className="mb-6 flex gap-2">
        {["", "active", "draft", "pending_review"].map((s) => (
          <button
            key={s || "all"}
            type="button"
            className={`btn-ghost text-sm ${status === s ? "border-brand-500" : ""}`}
            onClick={() => setStatus(s)}
          >
            {s || "All"}
          </button>
        ))}
      </div>

      {isLoading && <p>Loading…</p>}
      {error && <p className="text-red-400">{error.message}</p>}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {(data?.campaigns || []).map((c) => (
          <CampaignCard key={c.id} campaign={c} />
        ))}
      </div>
    </div>
  );
}
