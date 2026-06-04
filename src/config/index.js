const config = {
  port: Number(process.env.PORT) || 4000,
  nodeEnv: process.env.NODE_ENV || "development",
  dataFile: process.env.DATA_FILE || "",
  redisUrl: process.env.REDIS_URL || "redis://localhost:6379",
  jwtSecret: process.env.JWT_SECRET || "dev-secret-change-in-production",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "7d",
  adminWallets: (process.env.ADMIN_WALLETS || "")
    .split(",")
    .map((w) => w.trim().toLowerCase())
    .filter(Boolean),
  corsOrigin: process.env.CORS_ORIGIN || "http://localhost:3000",
  rpcUrl: process.env.ETHEREUM_RPC_URL || "http://127.0.0.1:8545",
  contractAddress: process.env.CONTRACT_ADDRESS || "",
  chainId: Number(process.env.CHAIN_ID || process.env.NEXT_PUBLIC_CHAIN_ID || 31337),
};

module.exports = { config };
