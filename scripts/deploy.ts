import { ethers } from "hardhat";
import { Contract } from "ethers";
import { HardhatRuntimeEnvironment } from "hardhat/types";

// Get HRE if not in hardhat runtime environment
let hre: HardhatRuntimeEnvironment;
try {
  hre = require("hardhat");
} catch {
  console.log("Not in Hardhat Runtime Environment");
}

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);

  // Deploy WDOGE
  console.log("\nDeploying WDOGE...");
  const WDOGE = await ethers.getContractFactory("WDOGE");
  const wdoge = await WDOGE.deploy();
  await wdoge.waitForDeployment();
  console.log("WDOGE deployed to:", await wdoge.getAddress());

  // Deploy Bridge with initial parameters
  console.log("\nDeploying DogeBridge...");
  const minDeposit = ethers.parseEther("100");    // 100 DOGE minimum
  const maxDeposit = ethers.parseEther("1000000"); // 1M DOGE maximum
  const bridgeFee = ethers.parseEther("1");       // 1 DOGE fee
  
  const DogeBridge = await ethers.getContractFactory("DogeBridge");
  const bridge = await DogeBridge.deploy(
    await wdoge.getAddress(),
    minDeposit,
    maxDeposit,
    bridgeFee
  );
  await bridge.waitForDeployment();
  console.log("DogeBridge deployed to:", await bridge.getAddress());

  // Set bridge in WDOGE contract
  console.log("\nSetting bridge in WDOGE contract...");
  await wdoge.setBridge(await bridge.getAddress());
  console.log("Bridge set in WDOGE contract");

  // Deploy Staking
  console.log("\nDeploying WDOGEStaking...");
  const WDOGEStaking = await ethers.getContractFactory("WDOGEStaking");
  const staking = await WDOGEStaking.deploy(await wdoge.getAddress());
  await staking.waitForDeployment();
  console.log("WDOGEStaking deployed to:", await staking.getAddress());

  // Deploy Lending
  console.log("\nDeploying WDOGELending...");
  const WDOGELending = await ethers.getContractFactory("WDOGELending");
  const lending = await WDOGELending.deploy(await wdoge.getAddress());
  await lending.waitForDeployment();
  console.log("WDOGELending deployed to:", await lending.getAddress());

  // Verify contracts on Etherscan
  if (process.env.ETHERSCAN_API_KEY && hre) {
    console.log("\nVerifying contracts on Etherscan...");
    try {
      await hre.run("verify:verify", {
        address: await wdoge.getAddress(),
        constructorArguments: [],
      });

      await hre.run("verify:verify", {
        address: await bridge.getAddress(),
        constructorArguments: [
          await wdoge.getAddress(),
          minDeposit,
          maxDeposit,
          bridgeFee,
        ],
      });

      await hre.run("verify:verify", {
        address: await staking.getAddress(),
        constructorArguments: [await wdoge.getAddress()],
      });

      await hre.run("verify:verify", {
        address: await lending.getAddress(),
        constructorArguments: [await wdoge.getAddress()],
      });
    } catch (error) {
      console.error("Error verifying contracts:", error);
    }
  }

  // Output deployment summary
  console.log("\nDeployment Summary:");
  console.log("-------------------");
  console.log("WDOGE:", await wdoge.getAddress());
  console.log("DogeBridge:", await bridge.getAddress());
  console.log("WDOGEStaking:", await staking.getAddress());
  console.log("WDOGELending:", await lending.getAddress());
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 