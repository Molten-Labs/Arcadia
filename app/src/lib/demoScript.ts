export interface DemoStep {
  id: string;
  phase: "overview" | "trader" | "investor";
  caption: string;
  subcaption: string;
  route?: string;
  duration: number;
}

export const PHASE_META: Record<DemoStep["phase"], { label: string; color: string; dot: string }> = {
  overview: { label: "Protocol Overview", color: "text-primary",  dot: "bg-primary"  },
  trader:   { label: "Trader Flow",       color: "text-warning",  dot: "bg-warning"  },
  investor: { label: "Investor Flow",     color: "text-success",  dot: "bg-success"  },
};

export const DEMO_STEPS: DemoStep[] = [
  // ── Phase 1: Overview ──────────────────────────────────────────────────────
  {
    id: "welcome",
    phase: "overview",
    caption: "Welcome to Arcadia Protocol",
    subcaption:
      "A first-loss vault DeFi platform on Solana — where traders put their own capital at risk before touching a single investor dollar.",
    route: "/vaults",
    duration: 5500,
  },
  {
    id: "traders-leaderboard",
    phase: "overview",
    caption: "Traders build trust on-chain",
    subcaption:
      "Every manager posts junior capital as a first-loss buffer, creating a verifiable track record that investors can audit directly on-chain.",
    route: "/traders",
    duration: 5500,
  },
  {
    id: "how-it-works",
    phase: "overview",
    caption: "The first-loss mechanism",
    subcaption:
      "Trader losses hit junior capital first. Senior (investor) capital is only at risk after the buffer is fully depleted — structurally enforced on-chain.",
    route: "/how-it-works",
    duration: 5500,
  },

  // ── Phase 2: Trader Flow ───────────────────────────────────────────────────
  {
    id: "connect-trader",
    phase: "trader",
    caption: "Connecting as Aria Volkov",
    subcaption:
      "Elite-tier manager · 920 reputation score · $4.3M AUM across 2 active graduated vaults.",
    duration: 3000,
  },
  {
    id: "manager-dashboard",
    phase: "trader",
    caption: "Manager dashboard",
    subcaption:
      "Signal Macro I (+11.4% in 30d) and Signal Momentum II (+7.4% in 30d). Unclaimed performance fees accumulating above the high-water mark.",
    route: "/manager",
    duration: 5000,
  },
  {
    id: "create-vault-page",
    phase: "trader",
    caption: "Creating a new vault",
    subcaption:
      "The wizard walks through: strategy name, risk profile (fee + max slippage), and junior capital deposit — all submitted in one transaction bundle.",
    route: "/manager/create",
    duration: 4000,
  },
  {
    id: "create-vault-submit",
    phase: "trader",
    caption: "Posting 10,000 USDC as first-loss buffer",
    subcaption:
      "Junior capital is locked on-chain. Paper mode begins — 30 days of live trade history required before investor deposits open.",
    duration: 5500,
  },
  {
    id: "paper-mode",
    phase: "trader",
    caption: "Vault live in paper mode",
    subcaption:
      "No investor capital at risk yet. The protocol records every trade on-chain to build a tamper-proof, auditable track record.",
    duration: 4000,
  },
  {
    id: "trade-terminal",
    phase: "trader",
    caption: "Pro trading terminal",
    subcaption:
      "Full-featured terminal with live market data, multi-asset order routing via Jupiter, real-time positions panel, and NAV impact preview before each trade.",
    route: "/trade",
    duration: 5500,
  },
  {
    id: "execute-trades",
    phase: "trader",
    caption: "Executing paper trades",
    subcaption:
      "Each trade is recorded on-chain: pair, size, price, and NAV impact. The vault's track record updates live — prospective investors can audit every entry.",
    duration: 7000,
  },
  {
    id: "vault-post-trades",
    phase: "trader",
    caption: "Vault NAV updated after trading",
    subcaption:
      "The manager vault view reflects every trade: updated NAV chart, junior buffer health, activity log, and paper trade count toward graduation threshold.",
    duration: 4500,
  },
  {
    id: "graduate",
    phase: "trader",
    caption: "Vault graduates from paper mode!",
    subcaption:
      "30-day track record verified on-chain. Investor deposits are now open. Aria's reputation score increases and the vault appears in the marketplace.",
    duration: 4500,
  },

  // ── Phase 3: Investor Flow ─────────────────────────────────────────────────
  {
    id: "switch-investor",
    phase: "investor",
    caption: "Switching to investor view",
    subcaption:
      "Same wallet, different role. Investors browse the marketplace and monitor their positions from a unified portfolio dashboard.",
    duration: 2500,
  },
  {
    id: "investor-marketplace",
    phase: "investor",
    caption: "Graduated vaults marketplace",
    subcaption:
      "Only vaults with verified paper-mode track records appear. Junior buffer health, live NAV, and risk metrics shown for every vault.",
    route: "/vaults",
    duration: 5000,
  },
  {
    id: "vault-detail",
    phase: "investor",
    caption: "Signal Macro I — 84% junior buffer, +11.4% return",
    subcaption:
      "Full NAV history, capital stack breakdown, trade log, and risk metrics — all sourced on-chain and updated in real time.",
    route: "/vault/vlt-001",
    duration: 5000,
  },
  {
    id: "deposit",
    phase: "investor",
    caption: "Depositing 50,000 USDC",
    subcaption:
      "Protected by trader's first-loss buffer. Instant exit is available any time junior health drops below 20%.",
    duration: 5000,
  },
  {
    id: "portfolio",
    phase: "investor",
    caption: "Portfolio dashboard",
    subcaption:
      "Live position tracking, unrealized P&L, health meter, and per-vault alert thresholds — everything in one view.",
    route: "/portfolio",
    duration: 6000,
  },
];
