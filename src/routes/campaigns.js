const { Router } = require("express");
const multer = require("multer");
const { parse } = require("csv-parse/sync");
const {
  listCampaigns,
  getCampaignById,
  createCampaign,
  updateCampaign,
  duplicateCampaign,
  replaceWhitelist,
  getWhitelistEntry,
} = require("../db/repository");
const { requireAuth, optionalAuth } = require("../middleware/auth");
const { checkEligibility } = require("../services/eligibility");
const { buildMerkleTree } = require("../services/merkle");

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

function mapCampaign(row) {
  return {
    id: row.id,
    ownerWallet: row.owner_wallet,
    name: row.name,
    description: row.description,
    nftContractAddress: row.nft_contract_address,
    onChainCampaignId: row.on_chain_campaign_id,
    totalSupply: row.total_supply,
    remainingSupply: row.remaining_supply,
    startTime: row.start_time,
    endTime: row.end_time,
    maxClaimsPerWallet: row.max_claims_per_wallet,
    eligibilityType: row.eligibility_type,
    eligibilityConfig: row.eligibility_config,
    merkleRoot: row.merkle_root,
    status: row.status,
    imageUrl: row.image_url,
    createdAt: row.created_at,
  };
}

router.get("/", async (req, res, next) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);
    const rows = await listCampaigns({
      status: status || undefined,
      limit: Number(limit),
      offset,
    });
    res.json({ campaigns: rows.map(mapCampaign) });
  } catch (e) {
    next(e);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const row = await getCampaignById(req.params.id);
    if (!row) return res.status(404).json({ error: "Campaign not found" });
    res.json(mapCampaign(row));
  } catch (e) {
    next(e);
  }
});

router.post("/", requireAuth, async (req, res, next) => {
  try {
    const {
      name,
      description,
      totalSupply,
      eligibilityType = "public",
      eligibilityConfig = {},
      startTime,
      endTime,
      maxClaimsPerWallet = 1,
      nftContractAddress,
      imageUrl,
    } = req.body;

    const row = await createCampaign({
      owner_wallet: req.user.wallet,
      name,
      description: description || "",
      total_supply: totalSupply || 0,
      remaining_supply: totalSupply || 0,
      eligibility_type: eligibilityType,
      eligibility_config: eligibilityConfig,
      start_time: startTime || null,
      end_time: endTime || null,
      max_claims_per_wallet: maxClaimsPerWallet,
      nft_contract_address: nftContractAddress || null,
      image_url: imageUrl || null,
      status: "draft",
    });
    res.status(201).json(mapCampaign(row));
  } catch (e) {
    next(e);
  }
});

router.put("/:id", requireAuth, async (req, res, next) => {
  try {
    const c = await getCampaignById(req.params.id);
    if (!c) return res.status(404).json({ error: "Not found" });
    if (c.owner_wallet.toLowerCase() !== req.user.wallet.toLowerCase()) {
      return res.status(403).json({ error: "Forbidden" });
    }
    if (!["draft", "paused"].includes(c.status)) {
      return res.status(400).json({ error: "Only draft/paused campaigns editable" });
    }
    const { name, description, imageUrl } = req.body;
    const updated = await updateCampaign(req.params.id, {
      name: name ?? c.name,
      description: description ?? c.description,
      image_url: imageUrl ?? c.image_url,
    });
    res.json(mapCampaign(updated));
  } catch (e) {
    next(e);
  }
});

async function ownerAction(id, wallet, status) {
  const camp = await getCampaignById(id);
  if (!camp) return { error: "Not found", status: 404 };
  if (camp.owner_wallet.toLowerCase() !== wallet.toLowerCase()) {
    return { error: "Forbidden", status: 403 };
  }
  const updated = await updateCampaign(id, { status });
  return { campaign: mapCampaign(updated) };
}

router.post("/:id/submit", requireAuth, async (req, res, next) => {
  try {
    const r = await ownerAction(req.params.id, req.user.wallet, "pending_review");
    if (r.error) return res.status(r.status).json({ error: r.error });
    res.json(r.campaign);
  } catch (e) {
    next(e);
  }
});

router.post("/:id/pause", requireAuth, async (req, res, next) => {
  try {
    const r = await ownerAction(req.params.id, req.user.wallet, "paused");
    if (r.error) return res.status(r.status).json({ error: r.error });
    res.json(r.campaign);
  } catch (e) {
    next(e);
  }
});

router.post("/:id/resume", requireAuth, async (req, res, next) => {
  try {
    const r = await ownerAction(req.params.id, req.user.wallet, "active");
    if (r.error) return res.status(r.status).json({ error: r.error });
    res.json(r.campaign);
  } catch (e) {
    next(e);
  }
});

router.post("/:id/cancel", requireAuth, async (req, res, next) => {
  try {
    const r = await ownerAction(req.params.id, req.user.wallet, "cancelled");
    if (r.error) return res.status(r.status).json({ error: r.error });
    res.json(r.campaign);
  } catch (e) {
    next(e);
  }
});

router.post("/:id/duplicate", requireAuth, async (req, res, next) => {
  try {
    const o = await getCampaignById(req.params.id);
    if (!o) return res.status(404).json({ error: "Not found" });
    if (o.owner_wallet.toLowerCase() !== req.user.wallet.toLowerCase()) {
      return res.status(403).json({ error: "Forbidden" });
    }
    const dup = await duplicateCampaign(o, req.user.wallet);
    res.status(201).json(mapCampaign(dup));
  } catch (e) {
    next(e);
  }
});

router.post(
  "/:id/whitelist",
  requireAuth,
  upload.single("file"),
  async (req, res, next) => {
    try {
      const c = await getCampaignById(req.params.id);
      if (!c) return res.status(404).json({ error: "Not found" });
      if (c.owner_wallet.toLowerCase() !== req.user.wallet.toLowerCase()) {
        return res.status(403).json({ error: "Forbidden" });
      }

      const content = req.file.buffer.toString("utf8");
      const records = parse(content, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
      });

      const entries = records.map((r) => ({
        wallet_address: (r.wallet || r.address || r.wallet_address).toLowerCase(),
        allocation: parseInt(r.allocation || r.amount || "1", 10),
      }));

      const { root, proofs } = buildMerkleTree(entries);
      const whitelistRows = proofs.map((p) => ({
        wallet_address: p.wallet_address,
        allocation: p.allocation,
        proof: p.proof,
      }));

      await replaceWhitelist(req.params.id, whitelistRows, root);
      res.json({ merkleRoot: root, entries: proofs.length });
    } catch (e) {
      next(e);
    }
  }
);

router.get("/:id/eligibility", optionalAuth, async (req, res, next) => {
  try {
    const camp = await getCampaignById(req.params.id);
    if (!camp) return res.status(404).json({ error: "Not found" });
    const wallet = req.user?.wallet || req.query.wallet;
    if (!wallet) {
      return res.status(400).json({ error: "Connect wallet or pass ?wallet=" });
    }
    const result = await checkEligibility(
      req.user?.sub || null,
      wallet,
      camp
    );
    res.json(result);
  } catch (e) {
    next(e);
  }
});

router.get("/:id/merkle-proof", requireAuth, async (req, res, next) => {
  try {
    const entry = await getWhitelistEntry(req.params.id, req.user.wallet);
    if (!entry) {
      return res.status(404).json({ error: "Not whitelisted" });
    }
    res.json({
      allocation: entry.allocation,
      proof: entry.merkle_proof,
    });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
