const { MerkleTree } = require("merkletreejs");
const keccak256 = require("keccak256");
const { ethers } = require("ethers");

function buildLeaf(wallet, allocation) {
  const encoded = ethers.solidityPacked(
    ["address", "uint256"],
    [wallet, BigInt(allocation)]
  );
  const inner = ethers.keccak256(encoded);
  return ethers.keccak256(ethers.solidityPacked(["bytes32"], [inner]));
}

function buildMerkleTree(entries) {
  const leaves = entries.map((e) =>
    buildLeaf(e.wallet_address.toLowerCase(), e.allocation)
  );
  const tree = new MerkleTree(leaves, keccak256, { sortPairs: true });
  const root = tree.getHexRoot();
  const proofs = entries.map((e, i) => ({
    wallet_address: e.wallet_address.toLowerCase(),
    allocation: e.allocation,
    proof: tree.getHexProof(leaves[i]),
  }));
  return { root, proofs };
}

function verifyProof(wallet, allocation, proof, root) {
  const leaf = buildLeaf(wallet.toLowerCase(), allocation);
  const tree = new MerkleTree([], keccak256, { sortPairs: true });
  return tree.verify(proof, leaf, root);
}

module.exports = {
  buildLeaf,
  buildMerkleTree,
  verifyProof,
};
