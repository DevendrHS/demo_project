require("dotenv/config");
const { loadDb, DATA_FILE } = require("./store");

async function migrate() {
  await loadDb();
  console.log(`Data store ready: ${DATA_FILE}`);
}

migrate().catch((err) => {
  console.error(err);
  process.exit(1);
});
