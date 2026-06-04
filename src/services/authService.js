const { randomBytes } = require("crypto");
const jwt = require("jsonwebtoken");
const { SiweMessage } = require("siwe");
const {
  upsertUserNonce,
  findUserByWallet,
  findUserById,
  clearUserNonce,
} = require("../db/repository");
const { config } = require("../config");
const { setWithExpiry, getKey, deleteKey } = require("./redis");

async function createNonce(walletAddress) {
  const nonce = randomBytes(16).toString("hex");
  const expires = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  await upsertUserNonce(walletAddress, nonce, expires);
  return { nonce, expiresAt: expires };
}

async function verifySiwe(message, signature) {
  const siwe = new SiweMessage(message);
  const fields = await siwe.verify({ signature });
  const wallet = fields.data.address.toLowerCase();

  const user = await findUserByWallet(wallet);
  if (!user) {
    const err = new Error("User not found");
    err.status = 400;
    throw err;
  }
  if (user.nonce !== fields.data.nonce) {
    const err = new Error("Invalid nonce");
    err.status = 401;
    throw err;
  }
  if (new Date(user.nonce_expires_at) < new Date()) {
    const err = new Error("Nonce expired");
    err.status = 401;
    throw err;
  }

  await clearUserNonce(user.id);

  const token = jwt.sign(
    { sub: user.id, wallet },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn }
  );

  return { token, user: { id: user.id, wallet } };
}

async function getSession(userId) {
  return findUserById(userId);
}

async function storeIdempotency(userId, campaignId, key) {
  const redisKey = `claim:${userId}:${campaignId}:${key}`;
  const existing = await getKey(redisKey);
  if (existing) return false;
  await setWithExpiry(redisKey, "1", 3600);
  return true;
}

async function invalidateSession(userId) {
  await deleteKey(`session:${userId}`);
}

module.exports = {
  createNonce,
  verifySiwe,
  getSession,
  storeIdempotency,
  invalidateSession,
};
