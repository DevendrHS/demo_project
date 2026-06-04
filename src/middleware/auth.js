const jwt = require("jsonwebtoken");
const { config } = require("../config");

function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  try {
    const token = header.slice(7);
    req.user = jwt.verify(token, config.jwtSecret);
    next();
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }
}

function optionalAuth(req, _res, next) {
  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) {
    try {
      req.user = jwt.verify(header.slice(7), config.jwtSecret);
    } catch {
      req.user = null;
    }
  }
  next();
}

function requireAdmin(req, res, next) {
  if (!req.user?.wallet) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  if (!config.adminWallets.includes(req.user.wallet.toLowerCase())) {
    return res.status(403).json({ error: "Admin access required" });
  }
  next();
}

module.exports = { requireAuth, optionalAuth, requireAdmin };
