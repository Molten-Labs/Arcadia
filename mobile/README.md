# Arcadia Protocol — Mobile App

React Native / Expo mobile app for the Arcadia Protocol vault platform.

## Stack

- **Expo SDK 52** (managed workflow, Expo Router v4)
- **React Native** with TypeScript
- **TanStack Query** for data fetching
- **Expo Router** (file-based navigation)
- Mock data by default; connects to the Arcadia API when `EXPO_PUBLIC_KILN_API_URL` is set

## Screens

| Screen | Route | Description |
|--------|-------|-------------|
| Vaults | `/(tabs)/` | Marketplace — browse and filter all vaults |
| Portfolio | `/(tabs)/portfolio` | Investor positions, P&L summary |
| Traders | `/(tabs)/traders` | Manager leaderboard |
| Settings | `/(tabs)/settings` | Wallet, role, network config |
| Vault Detail | `/vault/[id]` | NAV chart, capital stack, deposit/withdraw |
| Trader Profile | `/trader/[wallet]` | Manager stats and their vaults |

## Quick Start

```bash
cd mobile
npm install
npx expo start
```

Scan the QR code with **Expo Go** (iOS or Android).

## Connect to the Backend

Set `EXPO_PUBLIC_KILN_API_URL` to your running Arcadia API server:

```bash
EXPO_PUBLIC_KILN_API_URL=http://192.168.x.x:8080 npx expo start
```

Use your machine's local IP (not `localhost`) so the device can reach it.

## Production Wallet (Mobile Wallet Adapter)

The current build uses a **demo wallet** (mock pubkey) that works in Expo Go.

For real on-chain transactions, add `@solana-mobile/mobile-wallet-adapter-protocol-web3js`:

```bash
npm install @solana-mobile/mobile-wallet-adapter-protocol-web3js react-native-get-random-values
npx expo run:android   # requires a custom dev build
```

Then replace the `WalletProvider` in `src/lib/wallet.tsx` with the MWA transact() flow.

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `EXPO_PUBLIC_KILN_API_URL` | _(empty — uses mock data)_ | Arcadia indexer API base URL |
| `EXPO_PUBLIC_RPC_URL` | `https://api.devnet.solana.com` | Solana RPC endpoint |
