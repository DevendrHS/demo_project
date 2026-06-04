const { expect } = require("chai");
const { ethers } = require("hardhat");
const { MerkleTree } = require("merkletreejs");
const keccak256 = require("keccak256");

function leaf(wallet, allocation) {
  const encoded = ethers.solidityPacked(["address", "uint256"], [wallet, allocation]);
  return ethers.keccak256(
    ethers.solidityPacked(["bytes32"], [ethers.keccak256(encoded)])
  );
}

describe("AirdropDistributor", function () {
  let distributor, nft, owner, user;

  beforeEach(async function () {
    [owner, user] = await ethers.getSigners();
    const MockERC721 = await ethers.getContractFactory("MockERC721");
    nft = await MockERC721.deploy("Test", "TST");
    const AirdropDistributor = await ethers.getContractFactory("AirdropDistributor");
    distributor = await AirdropDistributor.deploy();
    await nft.setMinter(await distributor.getAddress());

    const now = Math.floor(Date.now() / 1000);
    await distributor.createCampaign(
      await nft.getAddress(),
      1,
      100,
      10,
      now - 60,
      now + 86400,
      2,
      ethers.ZeroHash
    );
  });

  it("allows public claim", async function () {
    await distributor.connect(user).claim(1, user.address, 1, []);
    expect(await nft.ownerOf(1)).to.equal(user.address);
  });

  it("prevents double claim over max per wallet", async function () {
    await distributor.connect(user).claim(1, user.address, 2, []);
    await expect(
      distributor.connect(user).claim(1, user.address, 1, [])
    ).to.be.revertedWithCustomError(distributor, "MaxPerWalletExceeded");
  });

  it("verifies merkle whitelist", async function () {
    const allocation = 1n;
    const leaves = [leaf(user.address, allocation)];
    const tree = new MerkleTree(leaves, keccak256, { sortPairs: true });
    const root = tree.getHexRoot();

    const now = Math.floor(Date.now() / 1000);
    await distributor.createCampaign(
      await nft.getAddress(),
      101,
      200,
      5,
      now - 60,
      now + 86400,
      1,
      root
    );

    const proof = tree.getHexProof(leaves[0]);
    await distributor.connect(user).claim(2, user.address, 1, proof);
    expect(await nft.ownerOf(101)).to.equal(user.address);
  });
});
