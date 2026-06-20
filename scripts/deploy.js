const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying with:", deployer.address);

  const FEE_BPS = 250; // 2.5% marketplace fee
  const feeRecipient = deployer.address;

  const Factory = await hre.ethers.getContractFactory("NFTMarketplace");
  const market = await Factory.deploy(FEE_BPS, feeRecipient);
  await market.waitForDeployment();

  const address = await market.getAddress();
  console.log(`NFTMarketplace (fee ${FEE_BPS / 100}%) deployed to:`, address);
  console.log("Explorer:", `https://sepolia.basescan.org/address/${address}`);
  console.log("\nUpdate frontend/app.js -> CONTRACT_ADDRESS with this address.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
