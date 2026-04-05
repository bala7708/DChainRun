# ChainRun

ChainRun is a browser platformer connected to Hedera EVM smart contracts.

The project includes:
- A frontend game client with wallet integration
- Smart contracts for gameplay sessions, subscriptions, incubation, and rewards
- An oracle service that verifies gameplay proofs before score submission

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
- Hedera testnet account with EVM-compatible private key

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

3. Update `.env` and `agent/.env` with your keys and contract addresses.

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

- Connect wallet before on-chain actions.
- Subscription includes:
  - Paid plan (30 days)
  - One-time free trial (7 days)
- Incubation and material claims are chain-backed.

## Troubleshooting

- `npm run serve` fails from the parent folder:
  Run commands from `mario-chain/mario-chain`, or use `npm --prefix "...\mario-chain\mario-chain" run serve`.

- `INSUFFICIENT_TX_FEE` on deploy:
  Ensure the deployer wallet is funded on Hedera testnet and try again.

- Wallet connection issues:
  Use an injected wallet first (MetaMask/Brave wallet). WalletConnect can be used with a valid WalletConnect Cloud project ID.

## Security

- Never commit real private keys.
- Rotate any key that was ever shared in chat, logs, or screenshots.
