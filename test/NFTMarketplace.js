const { expect } = require("chai");
const { ethers } = require("hardhat");
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");

describe("NFTMarketplace", function () {
  const FEE_BPS = 250; // 2.5%
  const PRICE = ethers.parseEther("1");

  async function deploy() {
    const [owner, seller, buyer, other] = await ethers.getSigners();

    const NFT = await ethers.getContractFactory("TestNFT");
    const nft = await NFT.deploy();
    await nft.waitForDeployment();

    const Market = await ethers.getContractFactory("NFTMarketplace");
    const market = await Market.deploy(FEE_BPS, owner.address);
    await market.waitForDeployment();

    return { nft, market, owner, seller, buyer, other };
  }

  // Seller mints token #1 and approves the marketplace.
  async function withListing() {
    const ctx = await deploy();
    const { nft, market, seller } = ctx;
    await nft.connect(seller).mint(); // tokenId 1
    await nft.connect(seller).approve(await market.getAddress(), 1);
    await market.connect(seller).list(await nft.getAddress(), 1, PRICE);
    return ctx;
  }

  describe("Deployment", function () {
    it("stores fee config", async function () {
      const { market, owner } = await deploy();
      expect(await market.feeBps()).to.equal(BigInt(FEE_BPS));
      expect(await market.feeRecipient()).to.equal(owner.address);
      expect(await market.listingCount()).to.equal(0n);
    });

    it("rejects a fee above the cap", async function () {
      const [owner] = await ethers.getSigners();
      const Market = await ethers.getContractFactory("NFTMarketplace");
      await expect(Market.deploy(1001, owner.address)).to.be.revertedWith(
        "Fee too high"
      );
    });
  });

  describe("Listing", function () {
    it("lists an approved token and emits Listed", async function () {
      const { nft, market, seller } = await deploy();
      await nft.connect(seller).mint();
      await nft.connect(seller).approve(await market.getAddress(), 1);

      await expect(
        market.connect(seller).list(await nft.getAddress(), 1, PRICE)
      )
        .to.emit(market, "Listed")
        .withArgs(0, seller.address, await nft.getAddress(), 1, PRICE);

      const l = await market.getListing(0);
      expect(l.seller).to.equal(seller.address);
      expect(l.price).to.equal(PRICE);
      expect(l.active).to.equal(true);
    });

    it("rejects listing a token you don't own", async function () {
      const { nft, market, seller, other } = await deploy();
      await nft.connect(seller).mint();
      await expect(
        market.connect(other).list(await nft.getAddress(), 1, PRICE)
      ).to.be.revertedWith("Not owner");
    });

    it("rejects listing without approval", async function () {
      const { nft, market, seller } = await deploy();
      await nft.connect(seller).mint();
      await expect(
        market.connect(seller).list(await nft.getAddress(), 1, PRICE)
      ).to.be.revertedWith("Not approved");
    });

    it("rejects a zero price", async function () {
      const { nft, market, seller } = await deploy();
      await nft.connect(seller).mint();
      await nft.connect(seller).approve(await market.getAddress(), 1);
      await expect(
        market.connect(seller).list(await nft.getAddress(), 1, 0)
      ).to.be.revertedWith("Price must be > 0");
    });
  });

  describe("Buying", function () {
    it("transfers the NFT and splits payment (proceeds + fee)", async function () {
      const { nft, market, owner, seller, buyer } = await withListing();
      const fee = (PRICE * BigInt(FEE_BPS)) / 10000n;
      const proceeds = PRICE - fee;

      await expect(
        market.connect(buyer).buy(0, { value: PRICE })
      ).to.changeEtherBalances([seller, owner], [proceeds, fee]);

      expect(await nft.ownerOf(1)).to.equal(buyer.address);
      expect((await market.getListing(0)).active).to.equal(false);
    });

    it("emits Purchased", async function () {
      const { market, buyer } = await withListing();
      await expect(market.connect(buyer).buy(0, { value: PRICE }))
        .to.emit(market, "Purchased")
        .withArgs(0, buyer.address, PRICE);
    });

    it("refunds any overpayment (no ETH left in the marketplace)", async function () {
      const { market, buyer } = await withListing();
      // Pay 1.5 for a 1.0 listing — the extra 0.5 must be refunded.
      await market.connect(buyer).buy(0, { value: ethers.parseEther("1.5") });
      expect(
        await ethers.provider.getBalance(await market.getAddress())
      ).to.equal(0n);
    });

    it("rejects underpayment", async function () {
      const { market, buyer } = await withListing();
      await expect(
        market.connect(buyer).buy(0, { value: ethers.parseEther("0.5") })
      ).to.be.revertedWith("Insufficient payment");
    });

    it("cannot buy an inactive listing twice", async function () {
      const { market, buyer, other } = await withListing();
      await market.connect(buyer).buy(0, { value: PRICE });
      await expect(
        market.connect(other).buy(0, { value: PRICE })
      ).to.be.revertedWith("Not active");
    });
  });

  describe("Managing listings", function () {
    it("lets the seller cancel", async function () {
      const { market, seller } = await withListing();
      await expect(market.connect(seller).cancel(0))
        .to.emit(market, "Cancelled")
        .withArgs(0);
      expect((await market.getListing(0)).active).to.equal(false);
    });

    it("blocks non-sellers from cancelling", async function () {
      const { market, other } = await withListing();
      await expect(market.connect(other).cancel(0)).to.be.revertedWith(
        "Not seller"
      );
    });

    it("lets the seller update the price", async function () {
      const { market, seller } = await withListing();
      const newPrice = ethers.parseEther("2");
      await expect(market.connect(seller).updatePrice(0, newPrice))
        .to.emit(market, "PriceUpdated")
        .withArgs(0, newPrice);
      expect((await market.getListing(0)).price).to.equal(newPrice);
    });

    it("cannot buy after cancel", async function () {
      const { market, seller, buyer } = await withListing();
      await market.connect(seller).cancel(0);
      await expect(
        market.connect(buyer).buy(0, { value: PRICE })
      ).to.be.revertedWith("Not active");
    });
  });

  describe("Views", function () {
    it("reverts getListing for a missing id", async function () {
      const { market } = await deploy();
      await expect(market.getListing(0)).to.be.revertedWith("No such listing");
    });
  });

  describe("Price updates & edge cases", function () {
    it("rejects updating the price to zero", async function () {
      const { market, seller } = await withListing();
      await expect(
        market.connect(seller).updatePrice(0, 0)
      ).to.be.revertedWith("Price must be > 0");
    });

    it("buys at the updated price", async function () {
      const { market, seller, buyer, nft } = await withListing();
      const newPrice = ethers.parseEther("2");
      await market.connect(seller).updatePrice(0, newPrice);

      // Old price is now too low.
      await expect(
        market.connect(buyer).buy(0, { value: PRICE })
      ).to.be.revertedWith("Insufficient payment");

      await market.connect(buyer).buy(0, { value: newPrice });
      expect(await nft.ownerOf(1)).to.equal(buyer.address);
    });

    it("blocks updating a sold listing", async function () {
      const { market, seller, buyer } = await withListing();
      await market.connect(buyer).buy(0, { value: PRICE });
      await expect(
        market.connect(seller).updatePrice(0, ethers.parseEther("2"))
      ).to.be.revertedWith("Not active");
    });

    it("supports listing via setApprovalForAll", async function () {
      const { nft, market, seller } = await deploy();
      await nft.connect(seller).mint(); // tokenId 1
      await nft.connect(seller).setApprovalForAll(await market.getAddress(), true);
      await expect(
        market.connect(seller).list(await nft.getAddress(), 1, PRICE)
      ).to.emit(market, "Listed");
    });
  });
});
