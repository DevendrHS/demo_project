"use client";

import { useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "@/lib/api";

export default function EditCampaignPage() {
  const { id } = useParams();
  const queryClient = useQueryClient();
  const [file, setFile] = useState(null);

  const { data: campaign, isLoading } = useQuery({
    queryKey: ["campaign", id],
    queryFn: () => api(`/campaigns/${id}`),
  });

  const submitReview = useMutation({
    mutationFn: () => api(`/campaigns/${id}/submit`, { method: "POST" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["campaign", id] }),
  });

  async function uploadWhitelist(e) {
    e.preventDefault();
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    const token = localStorage.getItem("jwt");
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"}/campaigns/${id}/whitelist`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      }
    );
    const data = await res.json();
    if (!res.ok) alert(data.error || "Upload failed");
    else alert(`Merkle root: ${data.merkleRoot}`);
  }

  if (isLoading) return <p>Loading…</p>;

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <h1 className="text-2xl font-bold">Edit: {campaign.name}</h1>
      <div className="card">
        <p className="text-sm text-[var(--muted)]">Status: {campaign.status}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            className="btn-primary text-sm"
            onClick={() => submitReview.mutate()}
          >
            Submit for review
          </button>
        </div>
      </div>

      <form onSubmit={uploadWhitelist} className="card space-y-3">
        <h2 className="font-semibold">Whitelist CSV</h2>
        <p className="text-xs text-[var(--muted)]">
          Columns: wallet (or address), allocation
        </p>
        <input
          type="file"
          accept=".csv"
          onChange={(e) => setFile(e.target.files?.[0])}
        />
        <button type="submit" className="btn-ghost">
          Upload & generate Merkle tree
        </button>
      </form>
    </div>
  );
}
