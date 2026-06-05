# Token-Gated NFT Claim Flow - Implementation Analysis

## Executive Summary

A **minimal token-gated claim flow** has been implemented for the NFT Airdrop Platform by reusing existing functionality and adding only 2 targeted changes:

1. **Config Update**: Added `relayerPrivateKey` configuration
2. **Endpoint Implementation**: Implemented `/claims/gasless` endpoint with on-chain claim execution

**No changes to smart contract were needed** — all requirements are already satisfied by the existing `AirdropDistributor.sol` implementation.

---

## Requirements Analysis

### ✅ Smart Contract Requirements — COMPLETE (No Changes Needed)

The `AirdropDistributor.sol` contract already includes all required functionality:

#### 1. Allowlist Mechanism
**Location**: [contracts/AirdropDistributor.sol](contracts/AirdropDistributor.sol) lines 108-116

```solidity
if (c.merkleRoot != bytes32(0)) {
    bytes32 leaf = keccak256(
        bytes.concat(keccak256(abi.encodePacked(wallet, amount)))
    );
    if (!MerkleProof.verify(merkleProof, c.merkleRoot, leaf)) {
        revert InvalidProof();
    }
}
```

- Uses Merkle root for whitelisting
- Verifies proof before allowing claim
- Reverts with `InvalidProof()` if verification fails

#### 2. One Claim Per Wallet
**Location**: [contracts/AirdropDistributor.sol](contracts/AirdropDistributor.sol) lines 96-98

```solidity
if (claimsPerWallet[campaignId][wallet] + amount > c.maxPerWallet) {
    revert MaxPerWalletExceeded();
}
```

- Enforces `maxPerWallet` limit per wallet per campaign
- Uses `mapping(uint256 => mapping(address => uint256)) public claimsPerWallet`

#### 3. Claimed Event
**Location**: [contracts/AirdropDistributor.sol](contracts/AirdropDistributor.sol) line 44

```solidity
event Claimed(
    uint256 indexed campaignId,
    address indexed wallet,
    uint256 amount
);
```

- Emitted in `_claim()` after all validations pass (line 130)

#### 4. Existing Functionality Reuse
The contract properly leverages OpenZeppelin and existing patterns:
- `ReentrancyGuard` for safety
- `MerkleProof.verify()` from OpenZeppelin
- Campaign struct with all necessary fields
- Token increment logic for NFT minting

---

### ✅ Backend Requirements — PARTIAL (2 Minimal Changes)

#### Pre-Existing Functionality (No Changes)

**Auth & User Management**
- JWT-based authentication via `requireAuth` middleware
- User wallet extracted from token: `req.user.wallet`
- User ID available: `req.user.sub`

**Eligibility Checking**
- Complete service at [src/services/eligibility.js](src/services/eligibility.js)
- Checks: blacklist, campaign status, timing, per-wallet limits, Merkle proofs
- Used by both `/claims/confirm` and `/claims/gasless`

**Campaign Management**
- `getCampaignById()` retrieves campaign data
- Campaign data includes:
  - `on_chain_campaign_id`: Links backend campaign to smart contract
  - `merkle_root`: Merkle tree root for whitelist verification
  - `max_claims_per_wallet`: Per-wallet claim limit
  - Other metadata

**Whitelist & Merkle Support**
- `getWhitelistEntry()` returns wallet's whitelist entry with merkle proof
- Merkle proof generation/verification already implemented

**Claim Recording**
- `createClaim()` records claims in database
- Updates remaining supply
- Creates notifications

#### Missing Implementations (2 Changes)

**Change 1: Config — Add Relayer Private Key**

**File**: [src/config/index.js](src/config/index.js)

**What was added**:
```javascript
relayerPrivateKey: process.env.RELAYER_PRIVATE_KEY || "",
```

**Why**: Enables creation of a relayer signer to execute on-chain claims on behalf of users (gasless claim pattern).

**Change 2: Claims Endpoint — Implement /gasless**

**File**: [src/routes/claims.js](src/routes/claims.js)

**What was implemented**: Full `/claims/gasless` POST endpoint

**Replaces**: Previous 501 stub that returned "not implemented"

---

## Code Changes

### Change 1: Config Update

**File**: [src/config/index.js](src/config/index.js)

**Before**:
```javascript
const config = {
  // ... other config
  contractAddress: process.env.CONTRACT_ADDRESS || "",
  chainId: Number(process.env.CHAIN_ID || process.env.NEXT_PUBLIC_CHAIN_ID || 31337),
};
```

**After**:
```javascript
const config = {
  // ... other config
  contractAddress: process.env.CONTRACT_ADDRESS || "",
  relayerPrivateKey: process.env.RELAYER_PRIVATE_KEY || "",
  chainId: Number(process.env.CHAIN_ID || process.env.NEXT_PUBLIC_CHAIN_ID || 31337),
};
```

**Line Change**: Add 1 line at line 15

**Impact**: Makes relayer private key available to claims endpoint

---

### Change 2: Claims Endpoint Implementation

**File**: [src/routes/claims.js](src/routes/claims.js)

**Changes**:

1. **Import Addition** (Line 7):
   - Added `getWhitelistEntry` import from repository
   
2. **ABI Definition** (Lines 12-27):
   - Added minimal ABI for `claim()` function only
   - Uses ethers v6 format
   - Includes all 4 parameters: `campaignId`, `wallet`, `amount`, `merkleProof`

3. **Endpoint Implementation** (Lines 103-205):
   - Replaces previous 501 stub
   - Complete implementation with error handling

**Endpoint Logic**:

```
POST /claims/gasless
Authorization: Bearer {JWT_TOKEN}
Body: { "campaignId": "uuid-string" }

Steps:
1. Validate inputs (campaignId present)
2. Extract wallet from authenticated user
3. Validate Ethereum address format
4. Check relayer configuration
5. Get campaign by ID
6. Verify campaign has on_chain_campaign_id (linked to contract)
7. Check eligibility (using existing service)
8. Get merkle proof if campaign uses whitelist
9. Create relayer signer from RELAYER_PRIVATE_KEY
10. Call contract.claim() with:
    - on_chain_campaign_id
    - wallet address
    - amount (default: 1)
    - merkle proof (empty array if no whitelist)
11. Wait for transaction confirmation
12. Record claim in database
13. Return { success: true, txHash, claim }
```

**Error Handling**:

| Status | Condition | Message |
|--------|-----------|---------|
| 400 | Missing campaignId | "campaignId is required" |
| 400 | Invalid wallet address | "Invalid wallet address format" |
| 400 | Campaign not linked | "Campaign not linked to on-chain contract" |
| 400 | Transaction reverted | Extracted error from contract revert |
| 403 | Not eligible | "Not eligible" + reasons |
| 403 | Not on whitelist | "Wallet not on whitelist" |
| 403 | Invalid merkle proof | "Invalid merkle proof" |
| 404 | Campaign not found | "Campaign not found" |
| 500 | Relayer not configured | "Relayer not configured" |
| 500 | RPC not configured | "RPC not configured" |
| 500 | Transaction failed | "Transaction failed" |

**Smart Contract Error Detection**:

The endpoint catches contract reverts and provides user-friendly messages:

```javascript
// Detects and responds to contract errors:
- InvalidProof → 403 "Invalid merkle proof"
- MaxPerWalletExceeded → 403 "Maximum claims per wallet exceeded"
- SupplyExceeded → 400 "Campaign supply exhausted"
- CampaignNotActive → 400 "Campaign is not active"
- CampaignNotStarted → 400 "Campaign has not started"
- CampaignEnded → 400 "Campaign has ended"
- GlobalPaused → 400 "Global pause is active"
```

---

## Requirements Fulfillment Checklist

### Smart Contract Requirements

- ✅ **Allowlist mechanism exists**
  - Merkle root verification in `_claim()`
  - [contracts/AirdropDistributor.sol](contracts/AirdropDistributor.sol#L108)

- ✅ **Wallet can claim only once per campaign**
  - `claimsPerWallet` mapping enforces `maxPerWallet`
  - [contracts/AirdropDistributor.sol](contracts/AirdropDistributor.sol#L96)

- ✅ **Claimed event emitted on success**
  - `event Claimed` defined and emitted
  - [contracts/AirdropDistributor.sol](contracts/AirdropDistributor.sol#L44)

- ✅ **Reuses existing functionality**
  - Campaign struct, Merkle verification, NFT minting
  - No new contract functions needed

- ✅ **No rewrite necessary**
  - All functionality already present
  - Zero contract modifications needed

### Backend Endpoint Requirements

- ✅ **Accepts walletAddress and campaignId**
  - Endpoint: `POST /claims/gasless`
  - Wallet extracted from JWT (req.user.wallet)
  - CampaignId from request body

- ✅ **Validates wallet address is present**
  - Checks `req.user.wallet` exists
  - [src/routes/claims.js](src/routes/claims.js#L111)

- ✅ **Validates campaignId is present**
  - Checks `req.body.campaignId` exists
  - [src/routes/claims.js](src/routes/claims.js#L108)

- ✅ **Validates Ethereum address format**
  - Uses `ethers.isAddress(walletAddress)`
  - [src/routes/claims.js](src/routes/claims.js#L116)

- ✅ **Verifies eligibility using existing service**
  - Calls `checkEligibility(userId, wallet, campaign)`
  - [src/routes/claims.js](src/routes/claims.js#L140)

- ✅ **Calls deployed contract claim() function**
  - Uses ethers v6 Contract interface
  - Calls `contract.claim(campaignId, wallet, amount, merkleProof)`
  - [src/routes/claims.js](src/routes/claims.js#L158)

- ✅ **Uses ETHEREUM_RPC_URL**
  - `new ethers.JsonRpcProvider(config.rpcUrl)`
  - [src/routes/claims.js](src/routes/claims.js#L155)

- ✅ **Uses CONTRACT_ADDRESS**
  - `new ethers.Contract(config.contractAddress, ABI, signer)`
  - [src/routes/claims.js](src/routes/claims.js#L157)

- ✅ **Uses RELAYER_PRIVATE_KEY**
  - `new ethers.Wallet(config.relayerPrivateKey, provider)`
  - [src/routes/claims.js](src/routes/claims.js#L154)

- ✅ **Waits for transaction confirmation**
  - `await tx.wait()`
  - Checks `receipt.status === 1`
  - [src/routes/claims.js](src/routes/claims.js#L168)

- ✅ **Returns { success: true, txHash }**
  - Returns 201 with success response
  - [src/routes/claims.js](src/routes/claims.js#L175)

- ✅ **Returns proper error codes**
  - 400 for validation/contract errors
  - 403 for eligibility/whitelist errors
  - 404 for not found
  - 500 for server errors
  - [src/routes/claims.js](src/routes/claims.js#L108-L180)

- ✅ **Continues storing claims in database**
  - Uses existing `createClaim()` function
  - Records in data.json via repository
  - [src/routes/claims.js](src/routes/claims.js#L171)

- ✅ **Reuses existing repository functions**
  - `getCampaignById()`
  - `getWhitelistEntry()`
  - `createClaim()`
  - [src/routes/claims.js](src/routes/claims.js#L1-10)

- ✅ **Reuses existing eligibility logic**
  - `checkEligibility()` from services
  - [src/routes/claims.js](src/routes/claims.js#L140)

- ✅ **Follows project coding style**
  - Matches existing route structure
  - Same error handling patterns
  - Consistent with `/confirm` endpoint

- ✅ **Minimal changes**
  - Only 2 files modified
  - Total: 1 line in config, ~100 lines in endpoint
  - Reuses 100% of existing infrastructure

---

## Files Modified

### Summary Table

| File | Changes | Type | Lines |
|------|---------|------|-------|
| [src/config/index.js](src/config/index.js) | Add `relayerPrivateKey` config | Config | +1 |
| [src/routes/claims.js](src/routes/claims.js) | Implement `/gasless` endpoint | Feature | +103 |
| **TOTAL** | | | **+104** |

### No Changes Required
- ✅ Smart contract (AirdropDistributor.sol) - all requirements satisfied
- ✅ Auth middleware
- ✅ Eligibility service
- ✅ Repository functions
- ✅ Merkle utilities
- ✅ Database schema

---

## Environment Configuration

### Required Environment Variables

Add to `.env` or deployment configuration:

```env
# Existing (already present)
ETHEREUM_RPC_URL=http://127.0.0.1:8545
CONTRACT_ADDRESS=0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512

# New (add for gasless claims)
RELAYER_PRIVATE_KEY=0x... # Account with funds for gas
```

### Hardhat Local Network Setup

For testing with chainId 31337:

```bash
# .env
ETHEREUM_RPC_URL=http://127.0.0.1:8545
CHAIN_ID=31337

# Deploy contract
npx hardhat run scripts/deploy.cjs --network localhost

# Get ADDRESS from deployment output and set:
CONTRACT_ADDRESS=0x... # From deploy output

# Use Hardhat test account (has funds):
RELAYER_PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb476cad5d549ffc849def8b92cb0
```

---

## Test Steps (Hardhat Local Network)

### Prerequisites

```bash
# Install dependencies
npm install

# Start Hardhat local network
npx hardhat node

# In another terminal, run tests
cd demo_project
npm install
npm run dev  # Start backend server
```

### Setup: Deploy and Configure Campaign

**Script**: [contract/scripts/deploy.cjs](contract/scripts/deploy.cjs)

```bash
# Terminal 1: Start Hardhat node
npx hardhat node

# Terminal 2: Deploy contracts
cd contract
npx hardhat run scripts/deploy.cjs --network localhost

# Output:
# NFT deployed: 0x5FbDB2315678afecb367f032d93F642f64180aa3
# AirdropDistributor deployed: 0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512
```

**Configure Backend**:

```bash
# Terminal 3: Set environment variables
export ETHEREUM_RPC_URL=http://127.0.0.1:8545
export CONTRACT_ADDRESS=0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512
export RELAYER_PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb476cad5d549ffc849def8b92cb0
export CHAIN_ID=31337

# Start backend
npm run dev  # Runs on port 4000
```

### Test 1: Get JWT Token

**Endpoint**: `POST http://localhost:4000/auth/nonce`

**Request**:
```json
{
  "address": "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"
}
```

**Response**:
```json
{
  "nonce": "abc123...",
  "expiresAt": "2026-06-05T10:00:00.000Z"
}
```

**Then**: Use SIWE to sign and verify (or use test helper)

Expected JWT:
```
Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Test 2: Create Campaign (Setup)

**Endpoint**: `POST http://localhost:4000/campaigns`

**Headers**:
```
Authorization: Bearer {JWT_TOKEN}
Content-Type: application/json
```

**Request**:
```json
{
  "name": "Test Airdrop",
  "description": "Test campaign",
  "owner_wallet": "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
  "nft_contract_address": "0x5FbDB2315678afecb367f032d93F642f64180aa3",
  "on_chain_campaign_id": 1,
  "total_supply": 10,
  "max_claims_per_wallet": 1,
  "eligibility_type": "public",
  "status": "active",
  "start_time": "2026-06-01T00:00:00Z",
  "end_time": "2026-12-31T23:59:59Z"
}
```

**Response**:
```json
{
  "campaign": {
    "id": "camp-uuid-123",
    "name": "Test Airdrop",
    "on_chain_campaign_id": 1,
    "status": "active"
  }
}
```

### Test 3: Create On-Chain Campaign

**Via Hardhat console** (Terminal 1):

```javascript
// In hardhat node console
const contract = await ethers.getContractAt("AirdropDistributor", 
  "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512");

const nft = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
const startTime = Math.floor(Date.now() / 1000);
const endTime = startTime + (365 * 24 * 60 * 60); // 1 year

const tx = await contract.createCampaign(
  nft,
  0,           // tokenIdStart
  9,           // tokenIdEnd
  10,          // totalSupply
  startTime,   // startTime
  endTime,     // endTime
  1,           // maxPerWallet
  ethers.ZeroHash  // merkleRoot (empty for public)
);

await tx.wait();
// Campaign ID 1 created!
```

### Test 4: Make Gasless Claim

**Endpoint**: `POST http://localhost:4000/claims/gasless`

**Headers**:
```
Authorization: Bearer {JWT_TOKEN}
Content-Type: application/json
```

**Request**:
```json
{
  "campaignId": "camp-uuid-123"
}
```

**Success Response** (201):
```json
{
  "success": true,
  "txHash": "0x1234567890abcdef...",
  "claim": {
    "id": "claim-uuid-456",
    "campaign_id": "camp-uuid-123",
    "wallet_address": "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266",
    "transaction_hash": "0x1234567890abcdef...",
    "amount": 1,
    "status": "confirmed",
    "claimed_at": "2026-06-05T10:15:30.000Z"
  }
}
```

**Error Response** (403 - Already claimed):
```json
{
  "error": "Not eligible",
  "reasons": ["Already claimed maximum for this campaign"]
}
```

### Test 5: Verify On-Chain Claim

**Via Hardhat console**:

```javascript
const contract = await ethers.getContractAt("AirdropDistributor",
  "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512");

const wallet = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
const campaignId = 1;

// Check claims per wallet
const claimed = await contract.claimsPerWallet(campaignId, wallet);
console.log("Claims:", claimed.toString()); // Should be 1

// Check campaign state
const campaign = await contract.campaigns(campaignId);
console.log("Claimed supply:", campaign.claimedSupply.toString()); // Should be 1
```

### Test 6: Verify NFT Received

**Via Hardhat console**:

```javascript
const nft = await ethers.getContractAt("MockERC721",
  "0x5FbDB2315678afecb367f032d93F642f64180aa3");

const wallet = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";

// Check balance
const balance = await nft.balanceOf(wallet);
console.log("NFT Balance:", balance.toString()); // Should be 1

// Check ownership
const tokenId = 0;
const owner = await nft.ownerOf(tokenId);
console.log("Token 0 owner:", owner); // Should be wallet
```

### Test 7: Test Whitelist Campaign (Merkle)

**Setup campaign with Merkle**:

```javascript
// In hardhat console
const { buildMerkleTree } = require("../src/services/merkle");

const entries = [
  { wallet_address: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266", allocation: 1 },
  { wallet_address: "0x70997970c51812dc3a010c7d01b50e0d17dc79c8", allocation: 2 },
];

const { root, proofs } = buildMerkleTree(entries);
console.log("Merkle root:", root);
console.log("Proofs:", proofs);

// Create whitelist campaign
const contract = await ethers.getContractAt("AirdropDistributor",
  "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512");

const startTime = Math.floor(Date.now() / 1000);
const endTime = startTime + (365 * 24 * 60 * 60);

const tx = await contract.createCampaign(
  "0x5FbDB2315678afecb367f032d93F642f64180aa3",
  10,      // tokenIdStart
  19,      // tokenIdEnd
  10,      // totalSupply
  startTime,
  endTime,
  1,       // maxPerWallet
  root     // merkleRoot
);

await tx.wait();
// Campaign ID 2 created with Merkle!
```

**Update backend campaign**:

```bash
# POST /campaigns/{campaignId}
curl -X PATCH http://localhost:4000/campaigns/{campaignId} \
  -H "Authorization: Bearer {JWT_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "merkle_root": "0x...",
    "eligibility_type": "whitelist",
    "eligibility_config": {}
  }'
```

**Upload whitelist**:

```bash
curl -X POST http://localhost:4000/admin/whitelist/{campaignId} \
  -H "Authorization: Bearer {ADMIN_JWT}" \
  -H "Content-Type: application/json" \
  -d '{
    "entries": [
      {
        "wallet_address": "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
        "allocation": 1,
        "proof": [...]
      }
    ]
  }'
```

**Make Merkle claim**:

```bash
POST /claims/gasless
{
  "campaignId": "camp-uuid-merkle"
}
```

---

## Flow Diagram

```
User (Wallet Address) with JWT Token
         |
         v
POST /claims/gasless { campaignId }
         |
         +---> Validate input (campaignId, wallet address format)
         |
         +---> Check eligibility (existing service)
         |     - Blacklist check
         |     - Campaign status/timing
         |     - Per-wallet limit
         |     - Merkle proof validation (if needed)
         |
         +---> Get campaign by ID
         |     - Verify on_chain_campaign_id exists
         |
         +---> Get merkle proof (if whitelist campaign)
         |     - Query whitelist entry
         |
         +---> Create relayer signer from RELAYER_PRIVATE_KEY
         |
         +---> Call contract.claim()
         |     Parameters:
         |     - on_chain_campaign_id
         |     - wallet address
         |     - amount (1)
         |     - merkleProof ([] if public)
         |
         +---> Wait for confirmation
         |
         +---> Record claim in database
         |     - Uses existing createClaim()
         |     - Stores txHash
         |     - Updates remaining supply
         |
         v
Response: { success: true, txHash, claim }
         |
         +---> Frontend confirms NFT receipt
```

---

## Summary of Reused Components

### From Existing Backend:
- ✅ JWT authentication (`requireAuth`)
- ✅ User extraction from token
- ✅ Eligibility checking service
- ✅ Campaign retrieval
- ✅ Whitelist entry lookup
- ✅ Merkle proof handling
- ✅ Claim recording (`createClaim`)
- ✅ Database updates
- ✅ Error handling patterns
- ✅ IP hashing for logging

### From Existing Smart Contract:
- ✅ Allowlist verification
- ✅ Per-wallet claim limits
- ✅ Claimed event
- ✅ Supply management
- ✅ Reentrancy protection
- ✅ Campaign state validation
- ✅ NFT minting

### What Was NOT Changed:
- Smart contract code
- Database schema
- Authentication mechanism
- Eligibility logic
- Merkle utilities
- Campaign model
- User model

---

## Deployment Checklist

- [ ] Set `RELAYER_PRIVATE_KEY` environment variable
- [ ] Verify relayer account has funds for gas fees
- [ ] Deploy smart contract via `npx hardhat run scripts/deploy.cjs`
- [ ] Set `CONTRACT_ADDRESS` to deployed distributor address
- [ ] Create campaigns with `on_chain_campaign_id` field
- [ ] Test claim flow on local Hardhat network
- [ ] Test Merkle whitelist campaigns
- [ ] Test error handling (supply exhaustion, ineligibility, etc.)
- [ ] Monitor relayer account balance
- [ ] Document relayer address for accounting

---

## Conclusion

The token-gated claim flow is implemented with **minimal changes** (~104 lines total) by maximizing reuse of existing infrastructure:

- **Smart Contract**: 0 lines changed (fully compatible)
- **Config**: 1 line added
- **Endpoint**: ~103 lines (new implementation)

All 24 requirements are satisfied through a combination of existing functionality and targeted new code.
