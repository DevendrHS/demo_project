const crypto = require("crypto");
const { Router } = require("express");
const { ethers } = require("ethers");
const {
  getCampaignById,
  claimExistsByTxHash,
  createClaim,
} = require("../db/repository");
const { requireAuth } = require("../middleware/auth");
const { checkEligibility } = require("../services/eligibility");
const { storeIdempotency } = require("../services/authService");
const { config } = require("../config");

const router = Router();

function hashIp(ip) {
  return crypto.createHash("sha256").update(ip || "").digest("hex");
}

router.post("/confirm", requireAuth, async (req, res, next) => {
  try {
    const { campaignId, txHash, amount = 1, idempotencyKey } = req.body;
    if (!campaignId || !txHash) {
      return res.status(400).json({ error: "campaignId and txHash required" });
    }

    if (idempotencyKey) {
      const ok = await storeIdempotency(
        req.user.sub,
        campaignId,
        idempotencyKey
      );
      if (!ok) {
        return res.status(409).json({ error: "Duplicate claim request" });
      }
    }

    const camp = await getCampaignById(campaignId);
    if (!camp) {
      return res.status(404).json({ error: "Campaign not found" });
    }

    const eligibility = await checkEligibility(
      req.user.sub,
      req.user.wallet,
      camp
    );
    if (!eligibility.eligible) {
      return res.status(403).json({
        error: "Not eligible",
        reasons: eligibility.reasons,
      });
    }

    if (await claimExistsByTxHash(txHash)) {
      return res.status(409).json({ error: "Transaction already recorded" });
    }

    if (config.rpcUrl && config.contractAddress) {
      try {
        const provider = new ethers.JsonRpcProvider(config.rpcUrl);
        const receipt = await provider.getTransactionReceipt(txHash);
        if (!receipt || receipt.status !== 1) {
          return res.status(400).json({ error: "Transaction not confirmed" });
        }
      } catch {
        /* allow off-chain dev without RPC */
      }
    }

    const claim = await createClaim({
      campaign_id: campaignId,
      user_id: req.user.sub,
      wallet_address: req.user.wallet,
      transaction_hash: txHash,
      amount,
      ip_address: hashIp(req.ip),
    });

    res.status(201).json({ claim });
  } catch (e) {
    next(e);
  }
});

router.post("/gasless", requireAuth, async (req, res, next) => {
  try {
    res.status(501).json({
      error: "Gasless relayer not configured",
      hint: "Set RELAYER_PRIVATE_KEY and CONTRACT_ADDRESS",
    });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
