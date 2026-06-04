"use client";

import { useState } from "react";
import { BrowserProvider, Contract } from "ethers";
import { api } from "@/lib/api";
import { useWalletStore } from "@/lib/store";

const DISTRIBUTOR_ABI = [
  "function claim(uint256 campaignId, address wallet, uint256 amount, bytes32[] calldata merkleProof) external",
];

export function ClaimButton({ campaign }) {
  const { address } = useWalletStore();
  const [step, setStep] = useState("idle");
  const [error, setError] = useState(null);

  const contractAddress = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS;
  const onChainId = campaign.onChainCampaignId;

  async function handleClaim() {
    if (!address) {
      setError("Connect wallet first");
      return;
    }
    setError(null);
    setStep("checking");

    try {
      const eligibility = await api(
        `/campaigns/${campaign.id}/eligibility?wallet=${encodeURIComponent(address)}`
      );
      if (!eligibility.eligible) {
        setStep("idle");
        setError(eligibility.reasons?.join(", ") || "Not eligible");
        return;
      }

      let proof = [];
      if (campaign.eligibilityType === "whitelist") {
        const proofData = await api(`/campaigns/${campaign.id}/merkle-proof`);
        proof = proofData.proof || [];
      }

      if (!contractAddress || !onChainId) {
        setStep("confirming");
        const fakeTx = `0xdev${Date.now().toString(16)}`;
        await api("/claims/confirm", {
          method: "POST",
          body: JSON.stringify({
            campaignId: campaign.id,
            txHash: fakeTx,
            amount: 1,
            idempotencyKey: `${campaign.id}-${Date.now()}`,
          }),
        });
        setStep("success");
        return;
      }

      setStep("wallet");
      const provider = new BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const contract = new Contract(contractAddress, DISTRIBUTOR_ABI, signer);
      const tx = await contract.claim(onChainId, address, 1, proof);
      setStep("claiming");
      const receipt = await tx.wait();

      setStep("confirming");
      await api("/claims/confirm", {
        method: "POST",
        body: JSON.stringify({
          campaignId: campaign.id,
          txHash: receipt.hash,
          amount: 1,
          idempotencyKey: receipt.hash,
        }),
      });
      setStep("success");
    } catch (e) {
      setStep("failed");
      setError(e.message || "Claim failed");
    }
  }

  const labels = {
    idle: "Claim Now",
    checking: "Checking…",
    wallet: "Confirm in Wallet",
    claiming: "Claiming…",
    confirming: "Confirming…",
    success: "Claimed!",
    failed: "Retry Claim",
  };

  return (
    <div className="space-y-2">
      <button
        type="button"
        className="btn-primary w-full"
        disabled={!address || ["checking", "wallet", "claiming", "confirming"].includes(step)}
        onClick={handleClaim}
      >
        {labels[step] || "Claim"}
      </button>
      {error && <p className="text-sm text-red-400">{error}</p>}
      {!contractAddress && (
        <p className="text-xs text-[var(--muted)]">
          Dev mode: records off-chain claim when contract not configured.
        </p>
      )}
    </div>
  );
}
