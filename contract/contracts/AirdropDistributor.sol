// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./interfaces/IERC721Mintable.sol";

/**
 * @title AirdropDistributor
 * @notice On-chain campaign registry and NFT claim distribution with Merkle whitelist support.
 */
contract AirdropDistributor is ReentrancyGuard, Ownable {
    struct Campaign {
        address nftContract;
        uint256 tokenIdStart;
        uint256 tokenIdEnd;
        uint256 totalSupply;
        uint256 claimedSupply;
        uint256 startTime;
        uint256 endTime;
        uint256 maxPerWallet;
        bytes32 merkleRoot;
        bool isActive;
        address campaignOwner;
    }

    uint256 public campaignCounter;
    bool public globalPaused;

    mapping(uint256 => Campaign) public campaigns;
    mapping(uint256 => mapping(address => uint256)) public claimsPerWallet;
    mapping(uint256 => uint256) private nextTokenId;

    uint256 public constant WITHDRAW_TIMELOCK = 2 hours;
    mapping(uint256 => uint256) public withdrawUnlockTime;

    event CampaignCreated(
        uint256 indexed campaignId,
        address indexed owner,
        address nftContract
    );
    event Claimed(
        uint256 indexed campaignId,
        address indexed wallet,
        uint256 amount
    );
    event CampaignPaused(uint256 indexed campaignId);
    event CampaignResumed(uint256 indexed campaignId);
    event MerkleRootUpdated(uint256 indexed campaignId, bytes32 merkleRoot);
    event GlobalPauseToggled(bool paused);

    error CampaignNotActive();
    error CampaignEnded();
    error CampaignNotStarted();
    error SupplyExceeded();
    error MaxPerWalletExceeded();
    error InvalidProof();
    error GlobalPaused();
    error TimelockNotExpired();
    error NotCampaignOwner();

    modifier notGloballyPaused() {
        if (globalPaused) revert GlobalPaused();
        _;
    }

    constructor() Ownable(msg.sender) {}

    function createCampaign(
        address nftContract,
        uint256 tokenIdStart,
        uint256 tokenIdEnd,
        uint256 totalSupply,
        uint256 startTime,
        uint256 endTime,
        uint256 maxPerWallet,
        bytes32 merkleRoot
    ) external returns (uint256 campaignId) {
        campaignId = ++campaignCounter;
        campaigns[campaignId] = Campaign({
            nftContract: nftContract,
            tokenIdStart: tokenIdStart,
            tokenIdEnd: tokenIdEnd,
            totalSupply: totalSupply,
            claimedSupply: 0,
            startTime: startTime,
            endTime: endTime,
            maxPerWallet: maxPerWallet,
            merkleRoot: merkleRoot,
            isActive: true,
            campaignOwner: msg.sender
        });
        nextTokenId[campaignId] = tokenIdStart;
        emit CampaignCreated(campaignId, msg.sender, nftContract);
    }

    function setMerkleRoot(uint256 campaignId, bytes32 _merkleRoot) external {
        Campaign storage c = campaigns[campaignId];
        if (c.campaignOwner != msg.sender && msg.sender != owner()) {
            revert NotCampaignOwner();
        }
        c.merkleRoot = _merkleRoot;
        emit MerkleRootUpdated(campaignId, _merkleRoot);
    }

    function pauseCampaign(uint256 campaignId) external {
        Campaign storage c = campaigns[campaignId];
        if (c.campaignOwner != msg.sender && msg.sender != owner()) {
            revert NotCampaignOwner();
        }
        c.isActive = false;
        emit CampaignPaused(campaignId);
    }

    function resumeCampaign(uint256 campaignId) external {
        Campaign storage c = campaigns[campaignId];
        if (c.campaignOwner != msg.sender && msg.sender != owner()) {
            revert NotCampaignOwner();
        }
        c.isActive = true;
        emit CampaignResumed(campaignId);
    }

    function setGlobalPause(bool paused) external onlyOwner {
        globalPaused = paused;
        emit GlobalPauseToggled(paused);
    }

    function claim(
        uint256 campaignId,
        address wallet,
        uint256 amount,
        bytes32[] calldata merkleProof
    ) external nonReentrant notGloballyPaused {
        _claim(campaignId, wallet, amount, merkleProof);
    }

    function claimBatch(
        uint256[] calldata campaignIds,
        address wallet,
        uint256[] calldata amounts,
        bytes32[][] calldata merkleProofs
    ) external nonReentrant notGloballyPaused {
        require(
            campaignIds.length == amounts.length &&
                campaignIds.length == merkleProofs.length,
            "Length mismatch"
        );
        for (uint256 i = 0; i < campaignIds.length; i++) {
            _claim(campaignIds[i], wallet, amounts[i], merkleProofs[i]);
        }
    }

    function _claim(
        uint256 campaignId,
        address wallet,
        uint256 amount,
        bytes32[] calldata merkleProof
    ) internal {
        Campaign storage c = campaigns[campaignId];
        if (!c.isActive) revert CampaignNotActive();
        if (block.timestamp < c.startTime) revert CampaignNotStarted();
        if (block.timestamp > c.endTime) revert CampaignEnded();
        if (c.claimedSupply + amount > c.totalSupply) revert SupplyExceeded();
        if (claimsPerWallet[campaignId][wallet] + amount > c.maxPerWallet) {
            revert MaxPerWalletExceeded();
        }

        if (c.merkleRoot != bytes32(0)) {
            bytes32 leaf = keccak256(
                bytes.concat(keccak256(abi.encodePacked(wallet, amount)))
            );
            if (!MerkleProof.verify(merkleProof, c.merkleRoot, leaf)) {
                revert InvalidProof();
            }
        }

        claimsPerWallet[campaignId][wallet] += amount;
        c.claimedSupply += amount;

        for (uint256 i = 0; i < amount; i++) {
            uint256 tokenId = nextTokenId[campaignId];
            if (tokenId > c.tokenIdEnd) revert SupplyExceeded();
            IERC721Mintable(c.nftContract).mint(wallet, tokenId);
            nextTokenId[campaignId] = tokenId + 1;
        }

        emit Claimed(campaignId, wallet, amount);
    }

    function scheduleWithdraw(uint256 campaignId) external {
        Campaign storage c = campaigns[campaignId];
        if (c.campaignOwner != msg.sender && msg.sender != owner()) {
            revert NotCampaignOwner();
        }
        withdrawUnlockTime[campaignId] = block.timestamp + WITHDRAW_TIMELOCK;
    }

    function withdrawRemainingNFTs(uint256 campaignId) external {
        Campaign storage c = campaigns[campaignId];
        if (c.campaignOwner != msg.sender && msg.sender != owner()) {
            revert NotCampaignOwner();
        }
        if (withdrawUnlockTime[campaignId] == 0 ||
            block.timestamp < withdrawUnlockTime[campaignId]) {
            revert TimelockNotExpired();
        }
        // Owner can transfer unminted range off-chain via NFT contract admin
        c.isActive = false;
    }
}
