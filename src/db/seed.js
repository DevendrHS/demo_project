require("dotenv/config");
const { randomUUID } = require("crypto");
const { loadDb, saveDb } = require("./store");

async function seed() {
  const db = await loadDb();
  const owner = "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266";
  const exists = db.campaigns.some(
    (c) => c.name === "Genesis Public Drop"
  );
  if (!exists) {
    db.campaigns.push({
      id: randomUUID(),
      owner_wallet: owner,
      name: "Genesis Public Drop",
      description: "Sample public airdrop campaign for development.",
      nft_contract_address: null,
      on_chain_campaign_id: null,
      token_id_start: null,
      token_id_end: null,
      total_supply: 1000,
      remaining_supply: 1000,
      start_time: new Date(Date.now() - 86400000).toISOString(),
      end_time: new Date(Date.now() + 30 * 86400000).toISOString(),
      max_claims_per_wallet: 1,
      eligibility_type: "public",
      eligibility_config: {},
      merkle_root: null,
      status: "active",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      image_url: null,
      metadata_uri: null,
    });
    await saveDb();
    console.log("Seed campaign added");
  } else {
    console.log("Seed campaign already present");
  }
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
