const { Router } = require("express");
const { cookieParser } = require("cookie-parser-legacy");
const {
  createNonce,
  verifySiwe,
  getSession,
  invalidateSession,
} = require("../services/authService");
const { requireAuth } = require("../middleware/auth");

const router = Router();

router.post("/nonce", async (req, res, next) => {
  try {
    const { walletAddress } = req.body;
    if (!walletAddress) {
      return res.status(400).json({ error: "walletAddress required" });
    }
    const result = await createNonce(walletAddress);
    res.json(result);
  } catch (e) {
    next(e);
  }
});

router.post("/verify", async (req, res, next) => {
  try {
    const { message, signature } = req.body;
    if (!message || !signature) {
      return res.status(400).json({ error: "message and signature required" });
    }
    const result = await verifySiwe(message, signature);
    res.json(result);
  } catch (e) {
    next(e);
  }
});

router.get("/session", requireAuth, async (req, res, next) => {
  try {
    const session = await getSession(req.user.sub);
    if (!session) return res.status(404).json({ error: "Session not found" });
    res.json({
      id: session.id,
      wallet: session.wallet_address,
      email: session.email,
      settings: session.settings,
    });
  } catch (e) {
    next(e);
  }
});

router.post("/logout", requireAuth, async (req, res, next) => {
  try {
    await invalidateSession(req.user.sub);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
