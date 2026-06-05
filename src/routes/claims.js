const crypto = require("crypto");
const { Router } = require("express");
const { ethers } = require("ethers");
const {
  getCampaignById,
  claimExistsByTxHash,
  createClaim,
  getWhitelistEntry,
} = require("../db/repository");
const { requireAuth } = require("../middleware/auth");
const { checkEligibility } = require("../services/eligibility");
const { storeIdempotency } = require("../services/authService");
const { config } = require("../config");

// ABI for claim function only
const AIRDROP_DISTRIBUTOR_ABI = [
  {
    inputs: [
      { internalType: "uint256", name: "campaignId", type: "uint256" },
      { internalType: "address", name: "wallet", type: "address" },
      { internalType: "uint256", name: "amount", type: "uint256" },
      { internalType: "bytes32[]", name: "merkleProof", type: "bytes32[]" },
    ],
    name: "claim",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
];

const router = Router();

function hashIp(ip) {
  return crypto.createHash("sha256").update(ip || "").digest("hex");
}

router.post("/confirm", requireAuth, async (req, res, next) => {
  try {
    const { campaignId, txHash, amount = 1, idempotencyKey } = req.body;
    if (!campaignId || !txHash) {
      return res.status(400).json({ error: "campaignId and txHash required" });
    }

    if (idempotencyKey) {
      const ok = await storeIdempotency(
        req.user.sub,
        campaignId,
        idempotencyKey
      );
      if (!ok) {
        return res.status(409).json({ error: "Duplicate claim request" });
      }
    }

    const camp = await getCampaignById(campaignId);
    if (!camp) {
      return res.status(404).json({ error: "Campaign not found" });
    }

    const eligibility = await checkEligibility(
      req.user.sub,
      req.user.wallet,
      camp
    );
    if (!eligibility.eligible) {
      return res.status(403).json({
        error: "Not eligible",
        reasons: eligibility.reasons,
      });
    }

    if (await claimExistsByTxHash(txHash)) {
      return res.status(409).json({ error: "Transaction already recorded" });
    }

    if (config.rpcUrl && config.contractAddress) {
      try {
        const provider = new ethers.JsonRpcProvider(config.rpcUrl);
        const receipt = await provider.getTransactionReceipt(txHash);
        if (!receipt || receipt.status !== 1) {
          return res.status(400).json({ error: "Transaction not confirmed" });
        }
      } catch {
        /* allow off-chain dev without RPC */
      }
    }

    const claim = await createClaim({
      campaign_id: campaignId,
      user_id: req.user.sub,
      wallet_address: req.user.wallet,
      transaction_hash: txHash,
      amount,
      ip_address: hashIp(req.ip),
    });

    res.status(201).json({ claim });
  } catch (e) {
    next(e);
  }
});

router.post("/gasless", requireAuth, async (req, res, next) => {
  try {
    // Validate required parameters
    const { campaignId } = req.body;
    if (!campaignId) {
      return res.status(400).json({ error: "campaignId is required" });
    }

    // Get wallet from authenticated user
    const walletAddress = req.user.wallet;
    if (!walletAddress) {
      return res.status(400).json({ error: "User wallet not found" });
    }

    // Validate Ethereum address format
    if (!ethers.isAddress(walletAddress)) {
      return res.status(400).json({ error: "Invalid wallet address format" });
    }

    // Check configuration
    if (!config.contractAddress || !config.relayerPrivateKey) {
      return res.status(500).json({
        error: "Relayer not configured",
        hint: "Set CONTRACT_ADDRESS and RELAYER_PRIVATE_KEY environment variables",
      });
    }

    if (!config.rpcUrl) {
      return res.status(500).json({
        error: "RPC not configured",
        hint: "Set ETHEREUM_RPC_URL environment variable",
      });
    }

    // Get campaign
    const camp = await getCampaignById(campaignId);
    if (!camp) {
      return res.status(404).json({ error: "Campaign not found" });
    }

    // Verify campaign has on-chain ID
    if (!camp.on_chain_campaign_id) {
      return res.status(400).json({
        error: "Campaign not linked to on-chain contract",
      });
    }

    // Check eligibility
    const eligibility = await checkEligibility(
      req.user.sub,
      walletAddress,
      camp
    );
    if (!eligibility.eligible) {
      return res.status(403).json({
        error: "Not eligible",
        reasons: eligibility.reasons,
      });
    }

    // Prepare claim parameters
    const amount = 1;
    let merkleProof = [];

    // Get merkle proof if campaign uses merkle root
    if (camp.merkle_root) {
      const whitelistEntry = await getWhitelistEntry(campaignId, walletAddress);
      if (!whitelistEntry) {
        return res.status(403).json({ error: "Wallet not on whitelist" });
      }
      merkleProof = whitelistEntry.merkle_proof || [];
    }

    // Setup provider and signer (relayer)
    const provider = new ethers.JsonRpcProvider(config.rpcUrl);
    const relayerSigner = new ethers.Wallet(config.relayerPrivateKey, provider);

    // Create contract instance
    const contract = new ethers.Contract(
      config.contractAddress,
      AIRDROP_DISTRIBUTOR_ABI,
      relayerSigner
    );

    // Call claim function
    let tx;
    try {
      tx = await contract.claim(
        camp.on_chain_campaign_id,
        walletAddress,
        amount,
        merkleProof
      );
    } catch (error) {
      // Extract error message from contract revert
      const errorMessage = error.message || error.toString();
      if (errorMessage.includes("InvalidProof")) {
        return res.status(403).json({ error: "Invalid merkle proof" });
      }
      if (errorMessage.includes("MaxPerWalletExceeded")) {
        return res.status(403).json({ error: "Maximum claims per wallet exceeded" });
      }
      if (errorMessage.includes("SupplyExceeded")) {
        return res.status(400).json({ error: "Campaign supply exhausted" });
      }
      if (errorMessage.includes("CampaignNotActive")) {
        return res.status(400).json({ error: "Campaign is not active" });
      }
      if (errorMessage.includes("CampaignNotStarted")) {
        return res.status(400).json({ error: "Campaign has not started" });
      }
      if (errorMessage.includes("CampaignEnded")) {
        return res.status(400).json({ error: "Campaign has ended" });
      }
      if (errorMessage.includes("GlobalPaused")) {
        return res.status(400).json({ error: "Global pause is active" });
      }
      return res.status(400).json({
        error: "Transaction failed",
        detail: errorMessage,
      });
    }

    const txHash = tx.hash;

    // Wait for confirmation
    const receipt = await tx.wait();
    if (!receipt || receipt.status !== 1) {
      return res.status(500).json({
        error: "Transaction failed",
        txHash,
      });
    }

    // Record claim in database
    const claim = await createClaim({
      campaign_id: campaignId,
      user_id: req.user.sub,
      wallet_address: walletAddress,
      transaction_hash: txHash,
      amount,
      ip_address: hashIp(req.ip),
    });

    res.status(201).json({
      success: true,
      txHash,
      claim,
    });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
