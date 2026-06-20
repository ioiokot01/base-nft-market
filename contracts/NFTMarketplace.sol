// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";

/// @title NFTMarketplace
/// @notice A simple ERC-721 marketplace. Sellers list a token for a fixed ETH
///         price (approval-based: the NFT stays in the seller's wallet until it
///         sells, like OpenSea). Buyers pay ETH; the seller is paid minus an
///         optional marketplace fee, and any overpayment is refunded.
/// @dev    Demonstrates working with an external ERC-721 via approvals, ETH
///         splitting (fee + proceeds + refund), and the `call` payment pattern.
contract NFTMarketplace {
    uint256 public constant MAX_FEE_BPS = 1000; // 10% cap
    uint256 public immutable feeBps;
    address public immutable feeRecipient;

    struct Listing {
        address seller;
        address nft;
        uint256 tokenId;
        uint256 price;
        bool active;
    }

    Listing[] private _listings;

    event Listed(
        uint256 indexed id,
        address indexed seller,
        address indexed nft,
        uint256 tokenId,
        uint256 price
    );
    event Purchased(uint256 indexed id, address indexed buyer, uint256 price);
    event Cancelled(uint256 indexed id);
    event PriceUpdated(uint256 indexed id, uint256 newPrice);

    constructor(uint256 _feeBps, address _feeRecipient) {
        require(_feeBps <= MAX_FEE_BPS, "Fee too high");
        require(_feeRecipient != address(0), "Zero recipient");
        feeBps = _feeBps;
        feeRecipient = _feeRecipient;
    }

    /// @notice List an ERC-721 token you own and have approved to this contract.
    function list(
        address nft,
        uint256 tokenId,
        uint256 price
    ) external returns (uint256 id) {
        require(price > 0, "Price must be > 0");
        IERC721 token = IERC721(nft);
        require(token.ownerOf(tokenId) == msg.sender, "Not owner");
        require(
            token.getApproved(tokenId) == address(this) ||
                token.isApprovedForAll(msg.sender, address(this)),
            "Not approved"
        );

        id = _listings.length;
        _listings.push(
            Listing({
                seller: msg.sender,
                nft: nft,
                tokenId: tokenId,
                price: price,
                active: true
            })
        );
        emit Listed(id, msg.sender, nft, tokenId, price);
    }

    /// @notice Buy a listed token. Pays the seller (minus fee) and refunds change.
    function buy(uint256 id) external payable {
        Listing storage l = _at(id);
        require(l.active, "Not active");
        require(msg.value >= l.price, "Insufficient payment");

        l.active = false; // effects before interactions (no re-entry)

        uint256 fee = (l.price * feeBps) / 10000;
        uint256 proceeds = l.price - fee;

        IERC721(l.nft).safeTransferFrom(l.seller, msg.sender, l.tokenId);
        _send(l.seller, proceeds);
        if (fee > 0) _send(feeRecipient, fee);
        if (msg.value > l.price) _send(msg.sender, msg.value - l.price);

        emit Purchased(id, msg.sender, l.price);
    }

    /// @notice Cancel your own active listing.
    function cancel(uint256 id) external {
        Listing storage l = _at(id);
        require(msg.sender == l.seller, "Not seller");
        require(l.active, "Not active");
        l.active = false;
        emit Cancelled(id);
    }

    /// @notice Update the price of your own active listing.
    function updatePrice(uint256 id, uint256 newPrice) external {
        require(newPrice > 0, "Price must be > 0");
        Listing storage l = _at(id);
        require(msg.sender == l.seller, "Not seller");
        require(l.active, "Not active");
        l.price = newPrice;
        emit PriceUpdated(id, newPrice);
    }

    // --- Views ---------------------------------------------------------------

    function listingCount() external view returns (uint256) {
        return _listings.length;
    }

    function getListing(uint256 id)
        external
        view
        returns (
            address seller,
            address nft,
            uint256 tokenId,
            uint256 price,
            bool active
        )
    {
        Listing storage l = _at(id);
        return (l.seller, l.nft, l.tokenId, l.price, l.active);
    }

    // --- Internal ------------------------------------------------------------

    function _at(uint256 id) private view returns (Listing storage) {
        require(id < _listings.length, "No such listing");
        return _listings[id];
    }

    function _send(address to, uint256 amount) private {
        (bool ok, ) = payable(to).call{value: amount}("");
        require(ok, "Transfer failed");
    }
}
