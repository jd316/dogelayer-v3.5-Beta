import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@nomicfoundation/hardhat-ethers";
import "@nomicfoundation/hardhat-chai-matchers";
import "@nomicfoundation/hardhat-verify";
import "hardhat-gas-reporter";
import "solidity-coverage";
import * as dotenv from "dotenv";
import { ethers } from "ethers";

dotenv.config();

const config: HardhatUserConfig = {
  solidity: {
    compilers: [
      {
        version: "0.8.20",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      }
    ]
  },
  networks: {
    hardhat: {
      chainId: 1337,
    },
    polygon: {
      url: process.env.POLYGON_RPC_URL || "",
      accounts: process.env.ADMIN_PRIVATE_KEY ? [process.env.ADMIN_PRIVATE_KEY] : [],
      chainId: 137,
    },
    mumbai: {
      url: process.env.MUMBAI_RPC_URL || "",
      accounts: process.env.ADMIN_PRIVATE_KEY ? [process.env.ADMIN_PRIVATE_KEY] : [],
      chainId: 80001,
    },
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS !== undefined,
    currency: "USD",
    coinmarketcap: process.env.COINMARKETCAP_API_KEY,
  },
  etherscan: {
    apiKey: {
      polygon: process.env.POLYGONSCAN_API_KEY || "",
      polygonMumbai: process.env.POLYGONSCAN_API_KEY || "",
    },
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
    root: ".",
  },
  mocha: {
    timeout: 40000,
  },
};

export default config; 