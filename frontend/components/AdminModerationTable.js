"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useState } from "react";

export function AdminModerationTable() {
  const queryClient = useQueryClient();
  const [comment, setComment] = useState("");

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-pending"],
    queryFn: () => api("/admin/campaigns/pending"),
  });

  const review = useMutation({
    mutationFn: ({ id, approved }) =>
      api(`/admin/campaigns/${id}/review`, {
        method: "POST",
        body: JSON.stringify({ approved, comment }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-pending"] }),
  });

  if (isLoading) return <p>Loading pending campaigns…</p>;
  if (error) {
    return (
      <p className="text-sm text-red-400">
        {error.message} — set ADMIN_WALLETS and sign in as admin.
      </p>
    );
  }

  const campaigns = data?.campaigns || [];

  if (!campaigns.length) {
    return <p className="text-sm text-[var(--muted)]">No campaigns pending review.</p>;
  }

  return (
    <div className="space-y-4">
      <textarea
        className="input"
        placeholder="Review comment (optional)"
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        rows={2}
      />
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-white/10 text-[var(--muted)]">
              <th className="py-2 pr-4">Name</th>
              <th className="py-2 pr-4">Owner</th>
              <th className="py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {campaigns.map((c) => (
              <tr key={c.id} className="border-b border-white/5">
                <td className="py-3 pr-4">{c.name}</td>
                <td className="py-3 pr-4 font-mono text-xs">{c.owner_wallet}</td>
                <td className="py-3 flex gap-2">
                  <button
                    type="button"
                    className="btn-primary text-xs"
                    onClick={() => review.mutate({ id: c.id, approved: true })}
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    className="btn-ghost text-xs"
                    onClick={() => review.mutate({ id: c.id, approved: false })}
                  >
                    Reject
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
