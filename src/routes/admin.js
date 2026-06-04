const { Router } = require("express");
const {
  listCampaignsByStatus,
  getCampaignById,
  updateCampaign,
  upsertBlacklist,
  getAnalytics,
} = require("../db/repository");
const { requireAuth, requireAdmin } = require("../middleware/auth");

const router = Router();
router.use(requireAuth, requireAdmin);

router.get("/campaigns/pending", async (_req, res, next) => {
  try {
    const campaigns = await listCampaignsByStatus("pending_review");
    res.json({ campaigns });
  } catch (e) {
    next(e);
  }
});

router.post("/campaigns/:id/review", async (req, res, next) => {
  try {
    const { approved, comment } = req.body;
    const camp = await getCampaignById(req.params.id);
    if (!camp) return res.status(404).json({ error: "Not found" });

    const status = approved ? "active" : "cancelled";
    const updated = await updateCampaign(req.params.id, {
      status,
      eligibility_config: {
        ...camp.eligibility_config,
        reviewComment: comment || "",
      },
    });
    res.json(updated);
  } catch (e) {
    next(e);
  }
});

router.post("/blacklist", async (req, res, next) => {
  try {
    const { walletAddress, reason, expiresAt } = req.body;
    if (!walletAddress) {
      return res.status(400).json({ error: "walletAddress required" });
    }
    await upsertBlacklist({
      wallet_address: walletAddress,
      reason,
      expires_at: expiresAt || null,
      created_by: req.user.wallet,
    });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

router.get("/analytics", async (_req, res, next) => {
  try {
    const stats = await getAnalytics();
    res.json({
      campaigns: stats.campaigns,
      claims: stats.claims,
      uniqueClaimers: stats.uniqueClaimers,
      users: stats.users,
    });
  } catch (e) {
    next(e);
  }
});

router.put("/settings", async (req, res, next) => {
  try {
    res.json({
      settings: req.body,
      note: "Persist to env or settings in production",
    });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
