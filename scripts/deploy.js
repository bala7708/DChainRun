// Hardhat deployment script for Hedera testnet.

const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("\n🚀 Dave Chain Deployment");
  console.log("=".repeat(50));
  console.log("Deployer:", deployer.address);

  const feeData = await ethers.provider.getFeeData();
  const baseGasPrice = feeData.gasPrice || feeData.maxFeePerGas || 1200000000000n;
  const deployOverrides = {
    gasLimit: 15000000n,
    gasPrice: baseGasPrice * 2n,
  };
  const txOverrides = {
    gasLimit: 1000000n,
    gasPrice: baseGasPrice * 2n,
  };
  console.log("Gas price (wei):", deployOverrides.gasPrice.toString());

  // ── 1. Deploy ExpToken (Hedera HTS) ────────────────────
  console.log("\n📦 Deploying ExpToken...");
  const ExpToken = await ethers.getContractFactory("ExpToken");
  const expToken = await ExpToken.deploy(deployOverrides);
  await expToken.waitForDeployment();
  console.log("✅ ExpToken:", await expToken.getAddress());

  // ── 2. Deploy LevelRegistry ────────────────────────────
  console.log("\n📦 Deploying LevelRegistry...");
  const LevelRegistry = await ethers.getContractFactory("LevelRegistry");
  const levelRegistry = await LevelRegistry.deploy(deployOverrides);
  await levelRegistry.waitForDeployment();
  console.log("✅ LevelRegistry:", await levelRegistry.getAddress());

  // ── 3. Deploy DaveAIOracle (Hedera oracle) ────────────
  // In production, AI_AGENT_SIGNER is the Hedera oracle wallet address
  const AI_AGENT_SIGNER = process.env.AI_AGENT_SIGNER || deployer.address;
  console.log("\n📦 Deploying DaveAIOracle...");
  const Oracle = await ethers.getContractFactory("DaveAIOracle");
  const oracle = await Oracle.deploy(AI_AGENT_SIGNER, deployOverrides);
  await oracle.waitForDeployment();
  console.log("✅ DaveAIOracle:", await oracle.getAddress());

  // ── 4. Deploy DaveChainGame (Hedera EVM) ──────────────
  console.log("\n📦 Deploying DaveChainGame...");
  const Game = await ethers.getContractFactory("DaveChainGame");
  const game = await Game.deploy(await oracle.getAddress(), await expToken.getAddress(), deployOverrides);
  await game.waitForDeployment();
  console.log("✅ DaveChainGame:", await game.getAddress());

  // ── 5. Wire up permissions ──────────────────────────────
  console.log("\n🔗 Configuring contracts...");
  let tx = await expToken.setGameContract(await game.getAddress(), txOverrides);
  await tx.wait();
  console.log("✅ ExpToken authorized DaveChainGame as minter");

  // ── 6. Save addresses ───────────────────────────────────
  const addresses = {
    network: (await ethers.provider.getNetwork()).name,
    chainId: Number((await ethers.provider.getNetwork()).chainId),
    deployer: deployer.address,
    deployedAt: new Date().toISOString(),
    contracts: {
      DaveChainGame: await game.getAddress(),
      ExpToken:       await expToken.getAddress(),
      DaveAIOracle:  await oracle.getAddress(),
      LevelRegistry:  await levelRegistry.getAddress(),
    }
  };

  const outPath = path.join(__dirname, "../deployments.json");
  fs.writeFileSync(outPath, JSON.stringify(addresses, null, 2));
  console.log("\n💾 Addresses saved to deployments.json");

  // Also update frontend/wallet.js automatically
  const walletPath = path.join(__dirname, "../frontend/wallet.js");
  let walletSrc = fs.readFileSync(walletPath, "utf8");
  walletSrc = walletSrc
    .replace(/DaveChainGame: '0x[0-9a-fA-F]+'/g, `DaveChainGame: '${await game.getAddress()}'`)
    .replace(/ExpToken: '0x[0-9a-fA-F]+'/g,       `ExpToken: '${await expToken.getAddress()}'`)
    .replace(/DaveAIOracle: '0x[0-9a-fA-F]+'/g,  `DaveAIOracle: '${await oracle.getAddress()}'`);
  fs.writeFileSync(walletPath, walletSrc);
  console.log("✅ frontend/wallet.js updated with live addresses");

  console.log("\n" + "=".repeat(50));
  console.log("🎮 Deployment complete!");
  console.log("=".repeat(50));
  console.log(JSON.stringify(addresses.contracts, null, 2));
  console.log("\nNext steps:");
  console.log("  1. Start the Hedera oracle agent: node agent/oracle_agent.js");
  console.log("  2. Open frontend/index.html in your browser");
  console.log("  3. Connect via WalletConnect and start playing!");
}

main().catch(err => { console.error(err); process.exit(1); });
