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
  const wdogeFactory = await ethers.getContractFactory("WDOGE");
  const wdoge = await wdogeFactory.deploy();
  await wdoge.waitForDeployment();
  const wdogeAddress = (wdoge as unknown as { target: string }).target;
  console.log("WDOGE deployed to:", wdogeAddress);

  // Deploy Bridge with initial parameters
  console.log("\nDeploying DogeBridge...");
  const minDeposit = ethers.parseEther("1");      // 1 DOGE minimum
  const maxDeposit = ethers.parseEther("1000000"); // 1M DOGE maximum
  const bridgeFee = ethers.parseEther("1");       // 1 DOGE fee
  
  const bridgeFactory = await ethers.getContractFactory("DogeBridge");
  const bridge = await bridgeFactory.deploy(
    wdogeAddress,
    minDeposit,
    maxDeposit,
    bridgeFee
  );
  await bridge.waitForDeployment();
  const bridgeAddress = (bridge as unknown as { target: string }).target;
  console.log("DogeBridge deployed to:", bridgeAddress);

  // Set bridge in WDOGE contract
  console.log("\nSetting bridge in WDOGE contract...");
  await wdoge.setBridge(bridgeAddress);
  console.log("Bridge set in WDOGE contract");

  // Deploy Staking
  console.log("\nDeploying WDOGEStaking...");
  const stakingFactory = await ethers.getContractFactory("WDOGEStaking");
  const staking = await stakingFactory.deploy(wdogeAddress);
  await staking.waitForDeployment();
  const stakingAddress = (staking as unknown as { target: string }).target;
  console.log("WDOGEStaking deployed to:", stakingAddress);

  // Deploy Lending
  console.log("\nDeploying WDOGELending...");
  const lendingFactory = await ethers.getContractFactory("WDOGELending");
  const lending = await lendingFactory.deploy(wdogeAddress);
  await lending.waitForDeployment();
  const lendingAddress = (lending as unknown as { target: string }).target;
  console.log("WDOGELending deployed to:", lendingAddress);

  // Verify contracts on Etherscan
  if (process.env.ETHERSCAN_API_KEY && hre) {
    console.log("\nVerifying contracts on Etherscan...");
    try {
      await hre.run("verify:verify", {
        address: wdogeAddress,
        constructorArguments: [],
      });

      await hre.run("verify:verify", {
        address: bridgeAddress,
        constructorArguments: [
          wdogeAddress,
          minDeposit,
          maxDeposit,
          bridgeFee,
        ],
      });

      await hre.run("verify:verify", {
        address: stakingAddress,
        constructorArguments: [wdogeAddress],
      });

      await hre.run("verify:verify", {
        address: lendingAddress,
        constructorArguments: [wdogeAddress],
      });
    } catch (error) {
      console.error("Error verifying contracts:", error);
    }
  }

  // Output deployment summary
  console.log("\nDeployment Summary:");
  console.log("-------------------");
  console.log("WDOGE:", wdogeAddress);
  console.log("DogeBridge:", bridgeAddress);
  console.log("WDOGEStaking:", stakingAddress);
  console.log("WDOGELending:", lendingAddress);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 