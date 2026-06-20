# NFT Marketplace

[![CI](https://github.com/ioiokot01/base-nft-market/actions/workflows/ci.yml/badge.svg)](https://github.com/ioiokot01/base-nft-market/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
![Solidity](https://img.shields.io/badge/Solidity-0.8.24-363636.svg)
![Chain](https://img.shields.io/badge/Base-Sepolia-0052ff.svg)

A simple **ERC-721 marketplace** for the [Base](https://base.org) ecosystem.
Sellers list a token for a fixed ETH price (approval-based — the NFT stays in the
seller's wallet until it sells, like OpenSea). Buyers pay ETH; the seller is paid
minus a marketplace fee, and any overpayment is refunded.

Project 10 (the finale) in a learning series. New concepts: composing with an
**external ERC-721** via approvals, **ETH splitting** (proceeds + fee + refund),
and the `call` payment pattern. Works with any ERC-721 — e.g. the
[MiniNFT](https://github.com/ioiokot01/base-mini-nft) collection from project 3.

## Stack

- [Hardhat 2](https://hardhat.org) — compile, test, deploy
- [OpenZeppelin Contracts 5](https://docs.openzeppelin.com/contracts/5.x/) — IERC721 / ERC721
- Solidity `0.8.24`
- Target chain: Base Sepolia (testnet)

## Getting started

```bash
npm install
npx hardhat compile
npx hardhat test
```

## Contract

`contracts/NFTMarketplace.sol`

| Function | Description |
| --- | --- |
| `list(address nft, uint256 tokenId, uint256 price)` | List an approved token |
| `buy(uint256 id)` *(payable)* | Buy a listing; pays seller minus fee, refunds change |
| `cancel(uint256 id)` | Seller cancels a listing |
| `updatePrice(uint256 id, uint256 newPrice)` | Seller changes the price |
| `getListing(uint256 id)` / `listingCount()` | Views |

Fee is set at deploy (`feeBps`, capped at 10%) and paid to `feeRecipient`.
Emits `Listed`, `Purchased`, `Cancelled`, `PriceUpdated`.

`contracts/TestNFT.sol` is a tiny mintable ERC-721 used only by the tests.

## Deploy

```bash
cp .env.example .env   # then fill in PRIVATE_KEY (testnet wallet only)
npm run deploy
```

## Roadmap

- [x] NFTMarketplace contract + tests
- [x] Deploy to Base Sepolia
- [x] Frontend (list, buy, manage)

## Deployments

| Network | Address |
| --- | --- |
| Base Sepolia | [`0xE7C5B54ADeAEdFa91Ac38E4b1ec43d6C5541eF18`](https://sepolia.basescan.org/address/0xE7C5B54ADeAEdFa91Ac38E4b1ec43d6C5541eF18) |

## Security notes

- Listing checks ownership and approval; buying re-checks the listing is active.
- A listing is marked inactive **before** any transfer/payment (no re-entrancy).
- Payments (proceeds, fee, refund) use the `call` pattern with success checks.
- Secrets (`.env`, private keys) are git-ignored and never committed.
- All development targets a **testnet** — no real funds.

## License

MIT
