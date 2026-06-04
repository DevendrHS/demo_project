import Link from "next/link";

const BADGES = {
  public: "Public",
  whitelist: "Whitelist",
  erc20: "Token Holders",
  erc721: "NFT Holders",
  role: "Role / Guild",
  multi: "Multi",
};

export function CampaignCard({ campaign }) {
  const badge = BADGES[campaign.eligibilityType] || campaign.eligibilityType;
  return (
    <Link href={`/campaign/${campaign.id}`} className="card block hover:border-brand-500/50">
      <div className="mb-3 flex items-start justify-between gap-2">
        <h3 className="font-semibold">{campaign.name}</h3>
        <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs capitalize">
          {campaign.status}
        </span>
      </div>
      <p className="mb-4 line-clamp-2 text-sm text-[var(--muted)]">
        {campaign.description || "No description"}
      </p>
      <div className="flex flex-wrap gap-2 text-xs text-[var(--muted)]">
        <span className="rounded bg-brand-500/20 px-2 py-1 text-brand-500">{badge}</span>
        <span>{campaign.remainingSupply} / {campaign.totalSupply} left</span>
      </div>
    </Link>
  );
}
