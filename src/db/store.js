const fs = require("fs/promises");
const path = require("path");

const DATA_FILE =
  process.env.DATA_FILE || path.join(__dirname, "../../data.json");

let cache = null;
let writeQueue = Promise.resolve();

const EMPTY_DB = {
  users: [],
  campaigns: [],
  claims: [],
  whitelist_entries: [],
  blacklist: [],
  eligibility_cache: [],
  notifications: [],
  user_sessions: [],
};

async function loadDb() {
  if (cache) return cache;
  try {
    const raw = await fs.readFile(DATA_FILE, "utf8");
    cache = { ...EMPTY_DB, ...JSON.parse(raw) };
  } catch (err) {
    if (err.code === "ENOENT") {
      cache = structuredClone(EMPTY_DB);
      await saveDb();
    } else {
      throw err;
    }
  }
  for (const key of Object.keys(EMPTY_DB)) {
    if (!Array.isArray(cache[key])) cache[key] = [];
  }
  return cache;
}

async function saveDb() {
  const data = cache || (await loadDb());
  writeQueue = writeQueue.then(() =>
    fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2), "utf8")
  );
  await writeQueue;
}

async function withDb(mutator) {
  const db = await loadDb();
  const result = await mutator(db);
  await saveDb();
  return result;
}

function nowIso() {
  return new Date().toISOString();
}

module.exports = {
  DATA_FILE,
  loadDb,
  saveDb,
  withDb,
  nowIso,
};
