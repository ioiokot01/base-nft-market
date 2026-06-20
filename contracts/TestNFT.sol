// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";

/// @title TestNFT
/// @notice A tiny mintable ERC-721 used only to exercise the marketplace in
///         tests. Not part of the deployed product.
contract TestNFT is ERC721 {
    uint256 public nextId = 1;

    constructor() ERC721("Test NFT", "TST") {}

    function mint() external returns (uint256 id) {
        id = nextId++;
        _mint(msg.sender, id);
    }
}
