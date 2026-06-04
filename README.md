# NFT Airdrop Platform

## Built features

### Web app (Next.js)

| Area | What works |
|------|------------|
| **Browse** | Home page lists campaigns with filters (all, active, draft, pending review). |
| **Campaign** | Detail page shows supply, schedule, eligibility type, live eligibility check, and claim button. |
| **Dashboard** | Signed-in users see eligible campaigns and claim history (`/dashboard`). |
| **Creator** | Create and edit campaigns, submit for review, pause/resume, duplicate; upload whitelist CSV to build Merkle root (`/creator/campaigns`). |
| **Admin** | Analytics cards, approve/reject pending campaigns, blacklist wallets (`/admin`, requires wallet in `ADMIN_WALLETS`). |
| **Wallet** | MetaMask connect + Sign-In with Ethereum (SIWE); JWT stored for API calls. |

Claims use the on-chain `AirdropDistributor` when `NEXT_PUBLIC_CONTRACT_ADDRESS` is set; otherwise the API records a dev-mode claim after eligibility passes.

### API (Express)

- **Auth** — `POST /auth/nonce`, `POST /auth/verify`, `GET /auth/session`, `POST /auth/logout`
- **Campaigns** — list/detail, create/update, submit, pause, resume, cancel, duplicate; whitelist CSV upload; `GET .../eligibility` and `GET .../merkle-proof`
- **Eligibility** — `public`, `whitelist` (Merkle-verified), and `erc20` (on-chain balance when `ETHEREUM_RPC_URL` is set)
- **Claims** — `POST /claims/confirm` with idempotency keys; stricter rate limits on `/claims/*`
- **Users** — `GET /users/me/claims`, `GET /users/me/eligible`
- **Admin** — pending queue, campaign review, blacklist, analytics, settings
- **Ops** — `GET /health`; Helmet, CORS, JSON body limit, global API rate limiting

Persistence is a single **`data.json`** file (no separate database server).

### Smart contracts (Hardhat)

- **`AirdropDistributor.sol`** — campaign registry, Merkle-based whitelist claims, supply limits
- **`MockERC721.sol`** — mintable NFT for local tests
- Compile, unit tests, local node, and deploy scripts under `contract/`

## Structure

```
├── package.json       # All dependencies & scripts (only package.json)
├── server.js          # API entry
├── data.json          # Static JSON datastore
├── src/               # Express routes, services, repository
├── frontend/          # Next.js app
├── contract/          # Hardhat + Solidity
└── .env.example
```

## Quick start

1. **Install dependencies** (from project root):

   ```bash
   npm install
   ```

2. **Environment**:

   ```bash
   cp .env.example .env
   ```

3. **Data store** — edit `data.json` or seed sample data:

   ```bash
   npm run db:init
   npm run db:seed
   ```

   All API reads/writes persist to `data.json`. Restart the API after manual edits to the file.

4. **Contracts** (optional, local chain):

   ```bash
   npm run contract:compile
   npm run contract:test
   # Terminal A: npm run contract:node
   # Terminal B: npm run contract:deploy
   ```

5. **Run API + web**:

   ```bash
   npm run dev
   ```

   - API: http://localhost:4000  
   - Web: http://localhost:3000  

## Admin access

Set `ADMIN_WALLETS` in `.env` to your connected wallet (lowercase). Sign in via **Connect Wallet**, then open `/admin`.

## Whitelist CSV format

```csv
wallet,allocation
0xabc...,1
0xdef...,2
```

Upload on **Creator → Edit campaign** to generate Merkle root and proofs.

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | API + Next.js concurrently |
| `npm run dev:api` | API only |
| `npm run dev:web` | Frontend only |
| `npm run db:init` | Verify / create `data.json` |
| `npm run db:seed` | Add sample campaign if missing |
| `npm run contract:compile` | Compile Solidity |
| `npm run contract:test` | Hardhat tests |
| `npm run build:web` | Production Next.js build |

## Planned next (stubs / config)

- ERC-20 balance checks (set `ETHEREUM_RPC_URL` + `eligibility_config`)  
- Gasless relayer (`POST /claims/gasless`)  
- OAuth webhooks (`/webhooks/*`)  
- Email via SendGrid (notifications queued in DB)  
