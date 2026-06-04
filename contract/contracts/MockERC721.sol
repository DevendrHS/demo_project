// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./interfaces/IERC721Mintable.sol";

contract MockERC721 is ERC721, Ownable, IERC721Mintable {
    address public minter;

    constructor(string memory name_, string memory symbol_)
        ERC721(name_, symbol_)
        Ownable(msg.sender)
    {}

    function setMinter(address _minter) external onlyOwner {
        minter = _minter;
    }

    function mint(address to, uint256 tokenId) external override {
        require(msg.sender == minter || msg.sender == owner(), "Not minter");
        _mint(to, tokenId);
    }
}
