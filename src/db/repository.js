const { randomUUID } = require("crypto");
const { loadDb, withDb, nowIso } = require("./store");

function lc(s) {
  return (s || "").toLowerCase();
}

// --- Users ---

async function upsertUserNonce(walletAddress, nonce, nonceExpiresAt) {
  return withDb((db) => {
    const wallet = lc(walletAddress);
    let user = db.users.find((u) => lc(u.wallet_address) === wallet);
    if (user) {
      user.nonce = nonce;
      user.nonce_expires_at = nonceExpiresAt;
    } else {
      user = {
        id: randomUUID(),
        wallet_address: wallet,
        nonce,
        nonce_expires_at: nonceExpiresAt,
        email: null,
        created_at: nowIso(),
        last_login_at: null,
        settings: {},
      };
      db.users.push(user);
    }
    return user;
  });
}

async function findUserByWallet(walletAddress) {
  const db = await loadDb();
  return (
    db.users.find((u) => lc(u.wallet_address) === lc(walletAddress)) || null
  );
}

async function findUserById(id) {
  const db = await loadDb();
  return db.users.find((u) => u.id === id) || null;
}

async function clearUserNonce(userId) {
  return withDb((db) => {
    const user = db.users.find((u) => u.id === userId);
    if (user) {
      user.nonce = null;
      user.nonce_expires_at = null;
      user.last_login_at = nowIso();
    }
    return user;
  });
}

// --- Campaigns ---

async function listCampaigns({ status, limit = 20, offset = 0 } = {}) {
  const db = await loadDb();
  let rows = [...db.campaigns];
  if (status) rows = rows.filter((c) => c.status === status);
  rows.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  return rows.slice(offset, offset + limit);
}

async function getCampaignById(id) {
  const db = await loadDb();
  return db.campaigns.find((c) => c.id === id) || null;
}

async function createCampaign(fields) {
  return withDb((db) => {
    const campaign = {
      id: randomUUID(),
      owner_wallet: lc(fields.owner_wallet),
      name: fields.name,
      description: fields.description || "",
      nft_contract_address: fields.nft_contract_address || null,
      on_chain_campaign_id: fields.on_chain_campaign_id ?? null,
      token_id_start: fields.token_id_start ?? null,
      token_id_end: fields.token_id_end ?? null,
      total_supply: fields.total_supply || 0,
      remaining_supply:
        fields.remaining_supply ?? (fields.total_supply || 0),
      start_time: fields.start_time || null,
      end_time: fields.end_time || null,
      max_claims_per_wallet: fields.max_claims_per_wallet ?? 1,
      eligibility_type: fields.eligibility_type || "public",
      eligibility_config: fields.eligibility_config || {},
      merkle_root: fields.merkle_root || null,
      status: fields.status || "draft",
      created_at: nowIso(),
      updated_at: nowIso(),
      image_url: fields.image_url || null,
      metadata_uri: fields.metadata_uri || null,
    };
    db.campaigns.push(campaign);
    return campaign;
  });
}

async function updateCampaign(id, patch) {
  return withDb((db) => {
    const c = db.campaigns.find((x) => x.id === id);
    if (!c) return null;
    if (patch.name !== undefined) c.name = patch.name;
    if (patch.description !== undefined) c.description = patch.description;
    if (patch.image_url !== undefined) c.image_url = patch.image_url;
    if (patch.status !== undefined) c.status = patch.status;
    if (patch.merkle_root !== undefined) c.merkle_root = patch.merkle_root;
    if (patch.eligibility_type !== undefined) {
      c.eligibility_type = patch.eligibility_type;
    }
    if (patch.eligibility_config !== undefined) {
      c.eligibility_config = {
        ...c.eligibility_config,
        ...patch.eligibility_config,
      };
    }
    if (patch.remaining_supply !== undefined) {
      c.remaining_supply = patch.remaining_supply;
    }
    c.updated_at = nowIso();
    return c;
  });
}

async function duplicateCampaign(source, ownerWallet) {
  return createCampaign({
    owner_wallet: ownerWallet,
    name: `${source.name} (copy)`,
    description: source.description,
    total_supply: source.total_supply,
    remaining_supply: source.total_supply,
    eligibility_type: source.eligibility_type,
    eligibility_config: source.eligibility_config,
    max_claims_per_wallet: source.max_claims_per_wallet,
    status: "draft",
  });
}

async function listCampaignsByStatus(status) {
  const db = await loadDb();
  return db.campaigns
    .filter((c) => c.status === status)
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
}

// --- Whitelist ---

async function replaceWhitelist(campaignId, entries, merkleRoot) {
  return withDb((db) => {
    db.whitelist_entries = db.whitelist_entries.filter(
      (e) => e.campaign_id !== campaignId
    );
    for (const e of entries) {
      db.whitelist_entries.push({
        id: randomUUID(),
        campaign_id: campaignId,
        wallet_address: lc(e.wallet_address),
        allocation: e.allocation,
        merkle_proof: e.proof,
      });
    }
    const c = db.campaigns.find((x) => x.id === campaignId);
    if (c) {
      c.merkle_root = merkleRoot;
      c.eligibility_type = "whitelist";
      c.updated_at = nowIso();
    }
    return { merkleRoot, count: entries.length };
  });
}

async function getWhitelistEntry(campaignId, wallet) {
  const db = await loadDb();
  return (
    db.whitelist_entries.find(
      (e) =>
        e.campaign_id === campaignId &&
        lc(e.wallet_address) === lc(wallet)
    ) || null
  );
}

// --- Blacklist ---

async function isBlacklisted(wallet) {
  const db = await loadDb();
  const now = Date.now();
  return db.blacklist.some((b) => {
    if (lc(b.wallet_address) !== lc(wallet)) return false;
    if (!b.expires_at) return true;
    return new Date(b.expires_at).getTime() > now;
  });
}

async function upsertBlacklist({ wallet_address, reason, expires_at, created_by }) {
  return withDb((db) => {
    const wallet = lc(wallet_address);
    let row = db.blacklist.find((b) => lc(b.wallet_address) === wallet);
    if (row) {
      row.reason = reason || "";
      row.expires_at = expires_at || null;
    } else {
      row = {
        id: randomUUID(),
        wallet_address: wallet,
        reason: reason || "",
        expires_at: expires_at || null,
        created_by: created_by || null,
        created_at: nowIso(),
      };
      db.blacklist.push(row);
    }
    return row;
  });
}

// --- Claims ---

async function getClaimedTotal(campaignId, wallet) {
  const db = await loadDb();
  return db.claims
    .filter(
      (c) =>
        c.campaign_id === campaignId &&
        lc(c.wallet_address) === lc(wallet) &&
        c.status === "confirmed"
    )
    .reduce((sum, c) => sum + (c.amount || 0), 0);
}

async function claimExistsByTxHash(txHash) {
  const db = await loadDb();
  return db.claims.some((c) => c.transaction_hash === txHash);
}

async function createClaim({
  campaign_id,
  user_id,
  wallet_address,
  transaction_hash,
  amount,
  ip_address,
}) {
  return withDb((db) => {
    const claim = {
      id: randomUUID(),
      campaign_id,
      user_id,
      wallet_address: lc(wallet_address),
      transaction_hash,
      amount: amount || 1,
      status: "confirmed",
      ip_address,
      claimed_at: nowIso(),
      referrer_id: null,
    };
    db.claims.push(claim);

    const camp = db.campaigns.find((c) => c.id === campaign_id);
    if (camp) {
      camp.remaining_supply = Math.max(
        (camp.remaining_supply || 0) - (amount || 1),
        0
      );
      camp.updated_at = nowIso();
    }

    db.notifications.push({
      id: randomUUID(),
      user_id,
      channel: "email",
      type: "claim_success",
      content: { campaignId: campaign_id, txHash: transaction_hash, amount },
      status: "pending",
      sent_at: null,
    });

    return claim;
  });
}

async function listClaimsByUser(userId) {
  const db = await loadDb();
  return db.claims
    .filter((c) => c.user_id === userId)
    .map((c) => {
      const camp = db.campaigns.find((x) => x.id === c.campaign_id);
      return { ...c, campaign_name: camp?.name || "Unknown" };
    })
    .sort((a, b) => new Date(b.claimed_at) - new Date(a.claimed_at));
}

// --- Eligibility cache ---

async function upsertEligibilityCache(userId, campaignId, isEligible, reasons) {
  return withDb((db) => {
    const expires = new Date(Date.now() + 5 * 60 * 1000).toISOString();
    let row = db.eligibility_cache.find(
      (e) => e.user_id === userId && e.campaign_id === campaignId
    );
    if (row) {
      row.is_eligible = isEligible;
      row.reasons = reasons;
      row.expires_at = expires;
    } else {
      row = {
        id: randomUUID(),
        user_id: userId,
        campaign_id: campaignId,
        is_eligible: isEligible,
        reasons,
        expires_at: expires,
      };
      db.eligibility_cache.push(row);
    }
    return row;
  });
}

// --- Analytics ---

async function getAnalytics() {
  const db = await loadDb();
  const confirmed = db.claims.filter((c) => c.status === "confirmed");
  const uniqueWallets = new Set(confirmed.map((c) => lc(c.wallet_address)));
  return {
    campaigns: db.campaigns.length,
    claims: confirmed.length,
    uniqueClaimers: uniqueWallets.size,
    users: db.users.length,
  };
}

module.exports = {
  upsertUserNonce,
  findUserByWallet,
  findUserById,
  clearUserNonce,
  listCampaigns,
  getCampaignById,
  createCampaign,
  updateCampaign,
  duplicateCampaign,
  listCampaignsByStatus,
  replaceWhitelist,
  getWhitelistEntry,
  isBlacklisted,
  upsertBlacklist,
  getClaimedTotal,
  claimExistsByTxHash,
  createClaim,
  listClaimsByUser,
  upsertEligibilityCache,
  getAnalytics,
};
