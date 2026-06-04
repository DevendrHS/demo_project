"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useWalletStore } from "@/lib/store";

export function EligibilityChecker({ campaignId }) {
  const { address } = useWalletStore();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["eligibility", campaignId, address],
    queryFn: () =>
      api(
        `/campaigns/${campaignId}/eligibility?wallet=${encodeURIComponent(address)}`
      ),
    enabled: !!address && !!campaignId,
    staleTime: 5 * 60 * 1000,
  });

  if (!address) {
    return <p className="text-sm text-[var(--muted)]">Connect wallet to check eligibility.</p>;
  }

  if (isLoading) {
    return <p className="text-sm">Checking eligibility…</p>;
  }

  const eligible = data?.eligible;
  const reasons = data?.reasons || [];

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-2xl">{eligible ? "✅" : "❌"}</span>
        <span className="font-medium">
          {eligible ? "Eligible" : "Not eligible"}
        </span>
        <button type="button" className="btn-ghost ml-auto text-xs" onClick={() => refetch()}>
          Refresh
        </button>
      </div>
      {reasons.length > 0 && (
        <ul className="list-inside list-disc text-sm text-[var(--muted)]">
          {reasons.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
