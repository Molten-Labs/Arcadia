# Arcadia Protocol — Mobile App

React Native / Expo mobile app for the Arcadia Protocol vault platform.

## Stack

- **Expo SDK 52** (managed workflow, Expo Router v4)
- **React Native** with TypeScript
- **TanStack Query** for data fetching
- **Expo Router** (file-based navigation)
- **Solana Mobile Wallet Adapter** for Android wallet signing
- Mock/API read fallback by default; connects to Arcadia API when `EXPO_PUBLIC_KILN_API_URL` is set

## Screens

| Screen | Route | Description |
|--------|-------|-------------|
| Vaults | `/(tabs)/` | Marketplace — browse and filter all vaults |
| Portfolio | `/(tabs)/portfolio` | Investor positions, P&L summary |
| Traders | `/(tabs)/traders` | Manager leaderboard |
| Manager | `/(tabs)/manager` | Trader console, manager stats, vault actions |
| Settings | `/(tabs)/settings` | Wallet, role, network config |
| Vault Detail | `/vault/[id]` | NAV chart, capital stack, deposit/withdraw |
| Create Vault | `/manager/create` | Paper-mode vault setup |
| Manager Vault | `/manager/vault/[id]` | Junior capital, NAV, graduation, fees |
| Trade Terminal | `/trade` | Guarded USDC ↔ WSOL operation flow |
| Trader Profile | `/trader/[wallet]` | Manager stats and their vaults |

## Quick Start

```bash
cd mobile
npm install
npm run start
```

Expo Go is fine for read-only/mock preview. Real Solana Mobile Wallet Adapter signing requires an Android custom dev build:

```bash
npm run android
npm run start:dev-client
```

Install a compatible wallet such as Phantom, Solflare, or Mock MWA Wallet on the Android emulator/device.

## Connect to the Backend

Set `EXPO_PUBLIC_KILN_API_URL` to your running Arcadia API server:

```bash
EXPO_PUBLIC_KILN_API_URL=http://192.168.x.x:8080 npx expo start
```

Use your machine's local IP (not `localhost`) so the device can reach it.

## Production Wallet (Mobile Wallet Adapter)

Android uses Mobile Wallet Adapter authorize/reauthorize/deauthorize state and submits transactions with `signAndSendTransactions`. iOS and Expo Go stay read-only/mock-compatible for v1 and show an Android signing requirement before real transaction submission.

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `EXPO_PUBLIC_KILN_API_URL` | _(empty — uses mock data)_ | Arcadia indexer API base URL |
| `EXPO_PUBLIC_RPC_URL` | `https://api.devnet.solana.com` | Solana RPC endpoint |
| `EXPO_PUBLIC_SOLANA_CLUSTER` | inferred from RPC | `devnet` or `mainnet-beta` |
| `EXPO_PUBLIC_ARCADIA_PROGRAM_ID` | current Arcadia program | Program id override |
| `EXPO_PUBLIC_USDC_MINT` | cluster default | USDC mint override |
| `EXPO_PUBLIC_PYTH_SOL_USD_ACCOUNT` | _(empty)_ | Pyth SOL/USD price account |
| `EXPO_PUBLIC_PYTH_USDC_USD_ACCOUNT` | _(empty)_ | Pyth USDC/USD price account |
| `EXPO_PUBLIC_JUPITER_API_URL` | `https://quote-api.jup.ag/v6` | Jupiter quote API base |

## Checks

```bash
npm run typecheck
npm run lint
```

Android device QA is still required for wallet approval, app backgrounding, and real transaction confirmation.
