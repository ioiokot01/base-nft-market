const hre = require("hardhat");

// Deployed NFTMarketplace on Base Sepolia.
const ADDRESS = "0xE7C5B54ADeAEdFa91Ac38E4b1ec43d6C5541eF18";

async function main() {
  const market = await hre.ethers.getContractAt("NFTMarketplace", ADDRESS);

  const fee = await market.feeBps();
  const count = Number(await market.listingCount());
  console.log("NFTMarketplace:", ADDRESS);
  console.log("Fee:", Number(fee) / 100, "%");
  console.log("Listings:", count);

  for (let id = 0; id < count; id++) {
    const l = await market.getListing(id);
    console.log(`\n  #${id} token ${l.tokenId} @ ${l.nft}`);
    console.log(
      `     ${hre.ethers.formatEther(l.price)} ETH · seller ${l.seller} · ${
        l.active ? "active" : "sold/cancelled"
      }`
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
