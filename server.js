require("dotenv/config");
const { createApp } = require("./src/app");
const { loadDb, DATA_FILE } = require("./src/db/store");

const PORT = process.env.PORT || 4000;

async function start() {
  await loadDb();
  console.log(`Data store: ${DATA_FILE}`);

  const app = createApp();
  app.listen(PORT, () => {
    console.log(`API listening on http://localhost:${PORT}`);
  });
}

start();
