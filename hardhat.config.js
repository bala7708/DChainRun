require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

const DEPLOYER_KEY = process.env.DEPLOYER_PRIVATE_KEY || "0x" + "a".repeat(64); // placeholder

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: { enabled: true, runs: 1 },
      viaIR: true,
    },
  },
  networks: {
    hardhat: {
      allowUnlimitedContractSize: true,
    },
    localhost: {
      url: "http://127.0.0.1:8545",
    },
    hedera_testnet: {
      url: "https://testnet.hashio.io/api",
      chainId: 296,
      accounts: [DEPLOYER_KEY],
      gas: "auto",
    },
    hedera_mainnet: {
      url: "https://mainnet.hashio.io/api",
      chainId: 295,
      accounts: [DEPLOYER_KEY],
    },
  },
  paths: {
    sources:   "./contracts",
    tests:     "./test",
    cache:     "./cache",
    artifacts: "./artifacts",
  },
};
