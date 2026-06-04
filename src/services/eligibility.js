const {
  isBlacklisted,
  getClaimedTotal,
  getWhitelistEntry,
  upsertEligibilityCache,
} = require("../db/repository");
const { verifyProof } = require("./merkle");
const { ethers } = require("ethers");
const { config } = require("../config");

const ERC20_ABI = ["function balanceOf(address) view returns (uint256)"];

async function checkEligibility(userId, wallet, campaign) {
  const reasons = [];
  let eligible = true;

  if (await isBlacklisted(wallet)) {
    return { eligible: false, reasons: ["Wallet is blacklisted"] };
  }

  const claimed = await getClaimedTotal(campaign.id, wallet);
  if (claimed >= campaign.max_claims_per_wallet) {
    return {
      eligible: false,
      reasons: ["Already claimed maximum for this campaign"],
    };
  }

  if (campaign.status !== "active") {
    return { eligible: false, reasons: [`Campaign status: ${campaign.status}`] };
  }

  const now = new Date();
  if (campaign.start_time && new Date(campaign.start_time) > now) {
    reasons.push("Campaign has not started");
    eligible = false;
  }
  if (campaign.end_time && new Date(campaign.end_time) < now) {
    reasons.push("Campaign has ended");
    eligible = false;
  }
  if (campaign.remaining_supply <= 0) {
    reasons.push("No supply remaining");
    eligible = false;
  }

  const type = campaign.eligibility_type;
  const cfg = campaign.eligibility_config || {};

  if (type === "public") {
    /* passes */
  } else if (type === "whitelist") {
    const entry = await getWhitelistEntry(campaign.id, wallet);
    if (!entry) {
      reasons.push("Not on whitelist");
      eligible = false;
    } else if (campaign.merkle_root) {
      const ok = verifyProof(
        wallet,
        entry.allocation,
        entry.merkle_proof || [],
        campaign.merkle_root
      );
      if (!ok) {
        reasons.push("Invalid Merkle proof");
        eligible = false;
      }
    }
  } else if (type === "erc20") {
    try {
      const provider = new ethers.JsonRpcProvider(config.rpcUrl);
      const contract = new ethers.Contract(
        cfg.contractAddress,
        ERC20_ABI,
        provider
      );
      const balance = await contract.balanceOf(wallet);
      const min = BigInt(cfg.minBalance || 0);
      if (balance < min) {
        reasons.push(`ERC-20 balance below minimum (${cfg.minBalance})`);
        eligible = false;
      }
    } catch {
      reasons.push("Could not verify ERC-20 balance");
      eligible = false;
    }
  } else if (type === "erc721") {
    reasons.push(
      "NFT holding check: configure RPC and contract in eligibility_config"
    );
    if (!cfg.contractAddress) eligible = false;
  } else if (type === "multi") {
    if (cfg.requireAll) {
      reasons.push("Multi-condition: verify task completions in dashboard");
    }
  }

  if (userId) {
    await upsertEligibilityCache(userId, campaign.id, eligible, reasons);
  }

  return { eligible, reasons };
}

module.exports = { checkEligibility };
