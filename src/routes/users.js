const { Router } = require("express");
const {
  listClaimsByUser,
  listCampaignsByStatus,
} = require("../db/repository");
const { requireAuth } = require("../middleware/auth");
const { checkEligibility } = require("../services/eligibility");

const router = Router();

router.get("/me/claims", requireAuth, async (req, res, next) => {
  try {
    const claims = await listClaimsByUser(req.user.sub);
    res.json({ claims });
  } catch (e) {
    next(e);
  }
});

router.get("/me/eligible", requireAuth, async (req, res, next) => {
  try {
    const campaigns = await listCampaignsByStatus("active");
    const eligible = [];
    for (const camp of campaigns) {
      const result = await checkEligibility(
        req.user.sub,
        req.user.wallet,
        camp
      );
      if (result.eligible) {
        eligible.push({ id: camp.id, name: camp.name });
      }
    }
    res.json({ campaigns: eligible });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
