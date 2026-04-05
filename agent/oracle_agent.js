// Hedera Oracle Agent for ChainRun.
// Verifies gameplay proofs and signs responses for on-chain submission.

require("dotenv").config();
const { ethers } = require("ethers");
const express    = require("express");
const cors       = require("cors");

// ── Config ────────────────────────────────────────────────
const HEDERA_RPC   = process.env.HEDERA_RPC   || "https://testnet.hashio.io/api";
const AGENT_KEY    = process.env.AGENT_PRIVATE_KEY; // Hedera oracle wallet private key
const ORACLE_ADDR  = process.env.ORACLE_ADDRESS;
const GAME_ADDR    = process.env.GAME_ADDRESS;
const PORT         = process.env.PORT || 3001;

// Level physics constants (must match game.js)
const LEVEL_CONFIGS = {
  1:  { timeLimit: 120, enemySpeed: 1.0, platformGap: 80,  coinDensity: 0.8 },
  2:  { timeLimit: 110, enemySpeed: 1.2, platformGap: 100, coinDensity: 0.7 },
  3:  { timeLimit: 100, enemySpeed: 1.5, platformGap: 130, coinDensity: 0.6 },
  4:  { timeLimit: 90,  enemySpeed: 1.8, platformGap: 160, coinDensity: 0.5 },
  5:  { timeLimit: 85,  enemySpeed: 2.0, platformGap: 180, coinDensity: 0.5 },
  6:  { timeLimit: 80,  enemySpeed: 2.5, platformGap: 200, coinDensity: 0.4 },
  7:  { timeLimit: 75,  enemySpeed: 2.8, platformGap: 220, coinDensity: 0.35},
  8:  { timeLimit: 70,  enemySpeed: 3.0, platformGap: 240, coinDensity: 0.3 },
  9:  { timeLimit: 60,  enemySpeed: 3.5, platformGap: 260, coinDensity: 0.25},
  10: { timeLimit: 50,  enemySpeed: 4.5, platformGap: 300, coinDensity: 0.2 },
};

const ORACLE_ABI = [
  "event VerificationPassed(address indexed player, uint256 levelId, uint256 time)",
  "event VerificationFailed(address indexed player, uint256 levelId, string reason)",
];

// ── Providers & Signers ───────────────────────────────────
const hederaProvider = new ethers.providers.JsonRpcProvider(HEDERA_RPC);
const agentWallet    = AGENT_KEY
  ? new ethers.Wallet(AGENT_KEY, hederaProvider)
  : null;

// ── Express API ───────────────────────────────────────────
const app = express();
app.use(cors());
app.use(express.json());

/**
 * POST /verify
 * Called by the frontend before submitting on-chain.
 * Body: { player, levelId, claimedTime, inputEvents, stateHashes }
 * Returns: { valid, verifiedTime, proof }
 */
app.post("/verify", async (req, res) => {
  const { player, levelId, claimedTime, inputEvents, stateHashes } = req.body;

  if (!player || !levelId || !claimedTime) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    const result = await verifyGameplay({ player, levelId, claimedTime, inputEvents, stateHashes });
    res.json(result);
  } catch (err) {
    console.error("Verification error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.get("/health", (_, res) => res.json({ status: "ok", agent: agentWallet?.address }));

app.get("/leader/:levelId", async (req, res) => {
  try {
    const { levelId } = req.params;
    // Query on-chain for current leader
    res.json({ levelId, message: "Query on-chain via getLevelLeader()" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Core Verification Logic ───────────────────────────────
async function verifyGameplay({ player, levelId, claimedTime, inputEvents = [], stateHashes = [] }) {
  const config = LEVEL_CONFIGS[levelId];
  if (!config) throw new Error("Unknown level");

  const checks = {
    timeInBounds:      claimedTime > 0 && claimedTime <= config.timeLimit,
    inputCountPlausible: !inputEvents.length || inputEvents.length < claimedTime * 30, // max 30 inputs/sec
    noTeleport:        verifyStateHashChain(stateHashes),
    timingHumanlike:   verifyInputTiming(inputEvents),
    speedPlausible:    verifySpeedConstraints(inputEvents, config),
  };

  const passed = Object.values(checks).every(Boolean);
  const failedChecks = Object.entries(checks).filter(([, v]) => !v).map(([k]) => k);

  if (!passed) {
    console.log(`❌ Rejected ${player} level ${levelId}: ${failedChecks.join(", ")}`);
    return {
      valid: false,
      reason: `Failed checks: ${failedChecks.join(", ")}`,
      proof: "0x",
    };
  }

  // Sign the verified result for on-chain submission
  const proofTimestamp = Math.floor(Date.now() / 1000);
  const inputHash = ethers.utils.keccak256(
    ethers.utils.defaultAbiCoder.encode(
      ["address", "uint256", "uint256"],
      [player, levelId, inputEvents.length || 0]
    )
  );

  let proof = "0x";
  if (agentWallet) {
    const msgHash = ethers.utils.solidityKeccak256(
      ["address", "uint256", "uint256", "bytes32", "uint256"],
      [player, levelId, claimedTime, inputHash, proofTimestamp]
    );
    const signature = await agentWallet.signMessage(ethers.utils.arrayify(msgHash));
    proof = ethers.utils.defaultAbiCoder.encode(
      ["uint256", "bytes", "uint256", "bytes32"],
      [claimedTime, signature, proofTimestamp, inputHash]
    );
  } else {
    // Local fallback when the oracle key is not configured.
    const demoSig = ethers.utils.randomBytes(65);
    proof = ethers.utils.defaultAbiCoder.encode(
      ["uint256", "bytes", "uint256", "bytes32"],
      [claimedTime, demoSig, proofTimestamp, inputHash]
    );
  }

  console.log(`✅ Verified ${player} level ${levelId} in ${claimedTime}s`);
  return { valid: true, verifiedTime: claimedTime, proof, checks };
}

// ── Physics validation helpers ────────────────────────────

function verifyStateHashChain(hashes) {
  // Each hash should be deterministically derived from the previous
  // Real implementation: replays full physics sim and checks hashes
  if (!hashes || hashes.length < 2) return true;
  for (let i = 1; i < hashes.length; i++) {
    if (hashes[i] === hashes[i - 1]) return false; // frozen state = hack
    if (!hashes[i].startsWith("0x"))  return false;
  }
  return true;
}

function verifyInputTiming(events) {
  if (!events || events.length < 2) return true;
  // Minimum human reaction time = 80ms between distinct inputs
  const MIN_REACTION_MS = 80;
  for (let i = 1; i < events.length; i++) {
    const delta = events[i].t - events[i - 1].t;
    if (delta > 0 && delta < MIN_REACTION_MS) return false; // tool-assisted speed
  }
  return true;
}

function verifySpeedConstraints(events, config) {
  if (!events || !events.length) return true;
  // Maximum horizontal speed in game = 8 px/frame, 60 fps
  // Minimum realistic completion steps depends on level width / speed
  const minSteps = Math.floor(3200 / (8 * 60)); // ~7 seconds at max speed for narrowest level
  const totalSecs = events.length > 0 ? (events[events.length - 1].t - events[0].t) / 1000 : 999;
  return totalSecs >= minSteps || events.length === 0;
}

// ── Start ─────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log("\n🤖 ChainRun — Hedera Oracle Agent");
  console.log("=".repeat(40));
  console.log(`Agent address: ${agentWallet?.address || "(demo mode — no key)"}`);
  console.log(`Hedera RPC:    ${HEDERA_RPC}`);
  console.log(`API running:   http://localhost:${PORT}`);
  console.log(`POST /verify   — verify gameplay proof`);
  console.log(`GET  /health   — agent status`);
  console.log("=".repeat(40));
  if (!AGENT_KEY) {
    console.log("⚠️  AGENT_PRIVATE_KEY not set — running in demo mode");
    console.log("   Proofs will not be cryptographically signed.");
  }
});

module.exports = { verifyGameplay };
