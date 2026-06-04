const { Router } = require("express");

const router = Router();

router.post("/twitter", (_req, res) => {
  res.json({ ok: true, message: "Twitter OAuth stub" });
});

router.post("/discord", (_req, res) => {
  res.json({ ok: true, message: "Discord OAuth stub" });
});

router.post("/claim", (req, res) => {
  res.json({ received: true, payload: req.body });
});

module.exports = router;
