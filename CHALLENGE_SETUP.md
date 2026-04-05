# Challenge Modes Setup

This guide explains how to run and test normal, instant, and weekly challenge modes.

## Start Services

Open separate terminals.

1. Oracle agent:

```bash
npm run agent
```

2. Frontend:

```bash
npm run serve
```

3. Optional local Hardhat node (for local-only contract testing):

```bash
npm run node
```

## Open the Game

- `http://localhost:4000`

## Test Flow

1. Connect wallet
2. Pick a level and set bet
3. Select mode:
- Normal
- Instant
- Weekly

## Instant Challenge

- Create a room with max players
- Join an existing room from the lobby
- Submit score after completion

## Weekly Challenge

- Join weekly pool
- Submit scores during the week
- Best valid time wins after weekly close

## If Something Fails

- Wallet not connected: connect first
- Oracle verification failed: check agent logs
- Contract call reverted: verify deployed addresses in `deployments.json` and `frontend/wallet.js`
- Frontend not opening: confirm `npm run serve` is running in the project root
