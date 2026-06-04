const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying with:", deployer.address);

  const MockERC721 = await hre.ethers.getContractFactory("MockERC721");
  const nft = await MockERC721.deploy("Airdrop NFT", "ADRP");
  await nft.waitForDeployment();
  const nftAddress = await nft.getAddress();

  const AirdropDistributor = await hre.ethers.getContractFactory(
    "AirdropDistributor"
  );
  const distributor = await AirdropDistributor.deploy();
  await distributor.waitForDeployment();
  const distributorAddress = await distributor.getAddress();

  await nft.setMinter(distributorAddress);

  const addresses = {
    network: hre.network.name,
    nft: nftAddress,
    distributor: distributorAddress,
    deployer: deployer.address,
    deployedAt: new Date().toISOString(),
  };

  const outDir = path.join(__dirname, "..", "deployments");
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(
    path.join(outDir, `${hre.network.name}.json`),
    JSON.stringify(addresses, null, 2)
  );

  console.log("MockERC721:", nftAddress);
  console.log("AirdropDistributor:", distributorAddress);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
