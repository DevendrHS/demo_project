const Redis = require("ioredis");
const { config } = require("../config");

let client = null;
const memoryStore = new Map();

function getRedis() {
  if (client) return client;
  try {
    client = new Redis(config.redisUrl, {
      maxRetriesPerRequest: 1,
      lazyConnect: true,
    });
    client.on("error", () => {});
    return client;
  } catch {
    return null;
  }
}

async function setWithExpiry(key, value, ttlSeconds) {
  const redis = getRedis();
  if (redis) {
    try {
      await redis.setex(key, ttlSeconds, value);
      return;
    } catch {
      /* fallback */
    }
  }
  memoryStore.set(key, { value, expires: Date.now() + ttlSeconds * 1000 });
}

async function getKey(key) {
  const redis = getRedis();
  if (redis) {
    try {
      return await redis.get(key);
    } catch {
      /* fallback */
    }
  }
  const entry = memoryStore.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expires) {
    memoryStore.delete(key);
    return null;
  }
  return entry.value;
}

async function deleteKey(key) {
  const redis = getRedis();
  if (redis) {
    try {
      await redis.del(key);
      return;
    } catch {
      /* fallback */
    }
  }
  memoryStore.delete(key);
}

module.exports = {
  getRedis,
  setWithExpiry,
  getKey,
  deleteKey,
};
