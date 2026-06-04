"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useWalletStore } from "@/lib/store";

export default function NewCampaignPage() {
  const router = useRouter();
  const { token } = useWalletStore();
  const [form, setForm] = useState({
    name: "",
    description: "",
    totalSupply: 100,
    eligibilityType: "public",
    maxClaimsPerWallet: 1,
  });
  const [error, setError] = useState(null);
  const [step, setStep] = useState(1);

  async function submit(e) {
    e.preventDefault();
    if (!token) {
      setError("Sign in with wallet first");
      return;
    }
    try {
      const campaign = await api("/campaigns", {
        method: "POST",
        body: JSON.stringify(form),
      });
      router.push(`/creator/campaigns/${campaign.id}/edit`);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="mb-6 text-3xl font-bold">Create campaign</h1>
      <p className="mb-4 text-sm text-[var(--muted)]">Step {step} of 2</p>

      <form onSubmit={submit} className="card space-y-4">
        {step === 1 && (
          <>
            <label className="block text-sm">
              Name
              <input
                className="input mt-1"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </label>
            <label className="block text-sm">
              Description
              <textarea
                className="input mt-1"
                rows={3}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </label>
            <button type="button" className="btn-primary w-full" onClick={() => setStep(2)}>
              Next
            </button>
          </>
        )}

        {step === 2 && (
          <>
            <label className="block text-sm">
              Total supply
              <input
                type="number"
                className="input mt-1"
                value={form.totalSupply}
                onChange={(e) =>
                  setForm({ ...form, totalSupply: Number(e.target.value) })
                }
              />
            </label>
            <label className="block text-sm">
              Eligibility
              <select
                className="input mt-1"
                value={form.eligibilityType}
                onChange={(e) =>
                  setForm({ ...form, eligibilityType: e.target.value })
                }
              >
                <option value="public">Public</option>
                <option value="whitelist">Whitelist</option>
                <option value="erc20">ERC-20 holders</option>
              </select>
            </label>
            <div className="flex gap-2">
              <button type="button" className="btn-ghost flex-1" onClick={() => setStep(1)}>
                Back
              </button>
              <button type="submit" className="btn-primary flex-1">
                Create draft
              </button>
            </div>
          </>
        )}
        {error && <p className="text-sm text-red-400">{error}</p>}
      </form>
    </div>
  );
}
