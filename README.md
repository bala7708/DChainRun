<<<<<<< HEAD
# DChainRun

ChainRun is a browser-based platformer that combines classic fast-paced level gameplay with Hedera-backed blockchain utility. Players run through themed worlds, avoid enemies and traps, collect coins, and finish levels within strict time limits while interacting with on-chain sessions, rewards, subscriptions, and verified challenge modes.

## Game Features

- 10 handcrafted levels across varied worlds including Mushroom Plains, Cave Crawlers, Koopa Coast, Sky Platform, Fire Kingdom, Haunted Mansion, Lava Fortress, Chain Chomp Ridge, and Dragoon's Nightmare.
- Platforming gameplay with enemies, coins, buffs, traps, moving hazards, and time-based completion goals.
- Multiple challenge types: normal runs, instant challenges, and weekly competitions.
- EXP-based progression, material collection, eggs, incubation, and subscription-based bonuses.
- Adaptive AI tuning that reacts to player performance to keep the game challenging without becoming static.

## Blockchain Features

- Built for Hedera Testnet using EVM-compatible smart contracts.
- On-chain game sessions, bets, reward pools, and challenge modes.
- Oracle-backed score verification before rewards are finalized.
- Wallet-based participation for entering levels, joining challenges, managing subscriptions, and receiving rewards.
- WalletConnect and injected-wallet support for broader user access.

## Tech Stack

- Frontend: HTML, CSS, vanilla JavaScript
- Contracts: Solidity + Hardhat
- Chain: Hedera Testnet (chain ID 296)
- Oracle service: Node.js + Express + ethers

## Project Layout

- `frontend/`
- `contracts/`
- `scripts/`
- `agent/`
- `hardhat.config.js`
- `deployments.json`

## Prerequisites

- Node.js 18+
- npm 9+
- Hedera testnet account with an EVM-compatible private key

## Setup

1. Install dependencies:

```bash
npm install
npm --prefix agent install
```

2. Create environment files:

```bash
copy .env.example .env
copy .env.example agent\.env
```

3. Update `.env` and `agent/.env` with keys and deployed contract addresses.

## Compile Contracts

```bash
npm run compile
```

## Deploy to Hedera Testnet

```bash
npm run deploy:hedera
```

The deploy script updates `deployments.json` and contract addresses in `frontend/wallet.js`.

## Run the Oracle Agent

```bash
npm run agent
```

Expected service URL:
- `http://localhost:3001`

Health check:
- `GET /health`

## Run the Frontend

```bash
npm run serve
```

Expected URL:
- `http://localhost:4000`

## Gameplay Notes

- Connect a wallet before using on-chain actions.
- Subscription includes a paid 30-day plan and a one-time 7-day free trial.
- Incubation and material claims are chain-backed.
- Instant gameplay can be tested locally using the dummy instant room fallback when no live room exists.

## Troubleshooting

- `npm run serve` fails from the parent folder:
  Run commands from `mario-chain/mario-chain`, or use `npm --prefix "...\mario-chain\mario-chain" run serve`.

- `INSUFFICIENT_TX_FEE` on deploy:
  Ensure the deployer wallet is funded on Hedera testnet and try again.

- Wallet connection issues:
  Use an injected wallet first. WalletConnect requires a valid WalletConnect Cloud project ID.

## Security

- Never commit real private keys.
- Rotate any key that was ever shared in chat, logs, or screenshots.
=======
# DChainRun

ChainRun Game Features

ChainRun is a browser-based platformer that combines classic fast-paced level gameplay with real blockchain utility. Players run through themed worlds, avoid enemies and traps, collect coins, and finish levels within strict time limits. The game is designed to feel dynamic and replayable, with adaptive challenge balancing and multiple competitive modes.

Core Game Features

- 10 handcrafted levels across varied worlds and themes, including Mushroom Plains, Cave Crawlers, Koopa Coast, Sky Platform, Fire Kingdom, Haunted Mansion, Lava Fortress, Chain Chomp Ridge, and Dragoon's Nightmare.
- Platforming gameplay with enemies, coins, buffs, traps, moving challenges, and time-based completion goals.
- Multiple challenge types: normal runs, instant challenges, and weekly challenges.
- Competitive play where players can join pools, submit their best completion times, and compete for rewards.
- EXP-based progression system with player ranks that grow as players complete levels and collect rewards.
- Material, egg, and incubation systems that add progression beyond a single play session.
- Super Runner subscription benefits including larger item bag capacity, extra incubation slots, and improved rare-drop chances.

Blockchain Features with Strong Hedera Integration

ChainRun is built around Hedera EVM smart contracts, which means gameplay is not only visual but also backed by on-chain actions.

- Built for Hedera Testnet using EVM-compatible smart contracts.
- On-chain game sessions: players start gameplay sessions through smart contracts.
- On-chain bets and reward pools: each level can require a minimum HBAR-based bet, and prize pools are managed on-chain.
- On-chain challenge modes: instant challenge rooms and weekly competitions are backed by contract logic.
- On-chain reward distribution: winners receive rewards through blockchain transactions.
- On-chain progression support: EXP rewards, player stats, subscriptions, incubation, and material-related mechanics are tied to contract state.
- Oracle-backed score verification helps prevent fake completion submissions before rewards are finalized.
- Transparent gameplay logic because contract-based rules can be inspected and verified.

Wallet and WalletConnect Features

Wallet connectivity is a major part of the ChainRun experience because blockchain actions require a live wallet connection.

- Supports injected EVM wallets such as MetaMask-compatible browser wallets.
- Supports WalletConnect for broader wallet access across devices and wallet apps.
- Players connect their wallet before starting blockchain-backed actions.
- Wallet connection is used for entering levels, joining challenges, paying subscriptions, and receiving rewards.
- WalletConnect support makes the game more accessible for users who do not want to rely only on a browser extension wallet.

Why Hedera Matters in This Game

Hedera is not just a network choice here; it is part of the product value.

- Fast and efficient transaction handling supports game actions without the heavy feel often associated with blockchain apps.
- HBAR-denominated gameplay actions make the in-game economy feel direct and measurable.
- Smart contract-backed sessions, rewards, and subscriptions make player progress more trustworthy and transparent.
- Hedera gives the game a strong Web3 foundation while keeping the experience close to a familiar browser game.

Adaptive AI Gameplay

ChainRun also uses an active adaptive AI agent to tune the gameplay experience. The AI does not simply keep the game fixed; it observes player performance and adjusts challenge levels to keep the experience engaging.

- If a player struggles on a level repeatedly, the adaptive AI can ease the difficulty by reducing pressure and giving the player a better chance to progress.
- If a player clears a level too easily, the next level can become harder to maintain excitement and challenge.
- This creates a more personalized flow where the game reacts to the player's skill level instead of using only static difficulty settings.

World Variety and Replay Value

The game offers strong variety through different world styles, enemy combinations, obstacle patterns, reward systems, and challenge modes. Even when players revisit the same level path, the experience stays fresh because the adaptive AI tuning changes the pressure, pacing, and difficulty curve from run to run. This makes each attempt feel more alive and less repetitive.

Short Game Description

ChainRun is a Web3 platformer powered by Hedera, WalletConnect, smart contracts, and adaptive AI. It blends classic action gameplay with blockchain-backed progression, wallet-based participation, verified results, and dynamic difficulty adjustment. The result is a game that feels competitive, replayable, and modern, with every run connected to a larger on-chain player journey.
>>>>>>> origin/main
