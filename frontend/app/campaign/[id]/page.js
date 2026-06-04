"use client";

import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import { EligibilityChecker } from "@/components/EligibilityChecker";
import { ClaimButton } from "@/components/ClaimButton";

export default function CampaignDetailPage() {
  const { id } = useParams();

  const { data: campaign, isLoading, error } = useQuery({
    queryKey: ["campaign", id],
    queryFn: () => api(`/campaigns/${id}`),
  });

  if (isLoading) return <p>Loading campaign…</p>;
  if (error) return <p className="text-red-400">{error.message}</p>;

  return (
    <div className="grid gap-8 lg:grid-cols-3">
      <div className="lg:col-span-2 card">
        <h1 className="mb-2 text-2xl font-bold">{campaign.name}</h1>
        <p className="mb-4 text-[var(--muted)]">{campaign.description}</p>
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-[var(--muted)]">Status</dt>
            <dd className="capitalize">{campaign.status}</dd>
          </div>
          <div>
            <dt className="text-[var(--muted)]">Supply</dt>
            <dd>
              {campaign.remainingSupply} / {campaign.totalSupply}
            </dd>
          </div>
          <div>
            <dt className="text-[var(--muted)]">Type</dt>
            <dd>{campaign.eligibilityType}</dd>
          </div>
          <div>
            <dt className="text-[var(--muted)]">Max per wallet</dt>
            <dd>{campaign.maxClaimsPerWallet}</dd>
          </div>
        </dl>
      </div>

      <div className="card space-y-6">
        <div>
          <h2 className="mb-3 font-semibold">Eligibility</h2>
          <EligibilityChecker campaignId={id} />
        </div>
        <div>
          <h2 className="mb-3 font-semibold">Claim</h2>
          <ClaimButton campaign={campaign} />
        </div>
      </div>
    </div>
  );
}
