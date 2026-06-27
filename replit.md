# Arcadia

On-chain trading reputation and fund management platform on Solana.

## Repo structure

```
app/               — Next.js 15 frontend (main app)
server-rs/         — Node.js indexer / API server (Express 5)
arcadia-program/   — Solana Anchor 1.0 program (Rust source)
lib/               — Shared packages (db, api-spec, api-zod, api-client-react)
scripts/           — Workspace utility scripts
```

## Run & Operate

- `pnpm --filter @workspace/arcadia-web run dev` — run Arcadia Next.js frontend (port 5000)
- `pnpm --filter @workspace/api-server run dev` — run the indexer API server (port 8080, `/api/`)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- **Frontend** (`app/`): Next.js 15 (App Router), React 19, Tailwind v4 (CSS-native theming)
- **Solana**: `@solana/wallet-adapter-react`, Phantom + Solflare adapters
- **Indexer** (`server-rs/`): Express 5; Arcadia API routes at `/arcadia/api/v1/`
- **Charts**: Recharts (equity curves, NAV history)
- **Program** (`arcadia-program/`): Anchor 1.0 (`arcadia_vault`) — Rust source in `arcadia-program/arcadia_vault/src/lib.rs`
- DB: PostgreSQL + Drizzle ORM
- Build: esbuild (CJS bundle)

## Where things live

- `app/` — Next.js 15 frontend
  - `app/app/` — App Router pages + API routes
  - `app/app/api/v1/` — Mock indexer API (traders, vaults, leaderboard, prices, auth, investors)
  - `app/app/page.tsx` — Landing page
  - `app/app/traders/` — Trader marketplace
  - `app/app/t/[handle]/` — Trader profile with equity chart + trade history
  - `app/app/vault/[profile]/` — Vault deposit/withdraw UI
  - `app/app/leaderboard/` — Ranked leaderboard table
  - `app/app/dashboard/` — Trader dashboard (wallet-gated)
  - `app/app/trade/` — Live simulated trading interface
  - `app/app/manage/` — Vault management
  - `app/app/analytics/` — Trade analytics + equity curve
  - `app/app/reputation/` — Score dial + tier progression
  - `app/app/payouts/` — Trader profit withdrawal
  - `app/app/portfolio/` — Investor portfolio view
  - `app/app/investments/` — Per-investment detail with NAV history
  - `app/app/returns/` — Transaction history + returns
  - `app/app/settings/` — Account settings
  - `app/components/` — ScoreDial, TierBadge, TraderCard, EquityChart, etc.
  - `app/lib/` — types.ts, utils.ts, mock-data.ts
- `server-rs/` — Express indexer/API server
- `arcadia-program/` — Anchor 1.0 program (Rust, reference only — compile locally)
- `lib/db/` — Drizzle ORM + PostgreSQL schema

## Architecture decisions

- **Next.js basePath `/arcadia`** — Replit proxy routes `/arcadia/*` to port 5000. `basePath: '/arcadia'` in `app/next.config.ts` routes correctly.
- **API routes in Next.js** — Arcadia's mock indexer lives at `app/app/api/v1/*`. Frontend fetches `${API_BASE}${path}` = `/arcadia/api/v1/*`. No dependency on the Express server at `/api`.
- **Wallet adapters — NO `@solana/wallet-adapter-wallets`** — This bundle includes Trezor → pulls `protobufjs` which is blocked by Replit's package firewall. Use only `@solana/wallet-adapter-phantom` + `@solana/wallet-adapter-solflare` individually.
- **Shares are data, not tokens** — The Anchor program tracks share balances in `InvestorPosition` accounts (PDAs). No token mint/burn for investor shares.
- **Rust program not compiled** — No `rustc`/`cargo`/`anchor` CLI in the Replit environment. The full Rust source is in `arcadia-program/` for reference and can be compiled in a local Solana dev environment.

## Product

Arcadia is a three-part protocol:
1. **Score** — On-chain trading reputation engine. Every closed trade emits `TradeClosed` events; an off-chain indexer computes Arcadia Score (0–1000) across sharpe, sortino, drawdown control, consistency. Score tiers: Verified (600–699), Established (700–799), Advanced (800–899), Elite (900+).
2. **Vault** — Each trader's profile is their vault. Investors deposit USDC, receive proportional shares (data not tokens). Profit above HWM is split by tier (20–35% to trader, 5% platform, remainder to investor NAV).
3. **Marketplace** — Public trader directory with search, sort by score/return/AUM/sortino, filter by open deposits.

## User preferences

- Next.js App Router required (not React Vite) for the Arcadia frontend
- No `@solana/wallet-adapter-wallets` bundle — use individual adapters only
- All authenticated pages should gracefully degrade when wallet is not connected
- Devnet only for now — label all simulated actions clearly as "devnet simulation"

## Gotchas

- **Wallet CSS import** — `@import "@solana/wallet-adapter-react-ui/styles.css"` must be in `globals.css` (not in layout.tsx) for Tailwind v4 PostCSS pipeline to work.
- **Next.js 15 params** — Route params are a Promise in Next.js 15. Use `params.then(({ handle }) => ...)` in route handlers.
- **Tailwind v4 theming** — No `tailwind.config.ts`. Design tokens live in `app/app/globals.css` under `@theme inline {}`. Use CSS vars like `var(--color-green)` in inline styles for dynamic colors.
- **Replit PORT** — Next.js dev reads `$PORT` (5000). The `package.json` dev script is `next dev --port $PORT --hostname 0.0.0.0`.
