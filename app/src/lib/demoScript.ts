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
  // ── Phase 1: Set the promise ───────────────────────────────────────────────
  {
    id: "welcome",
    phase: "overview",
    caption: "Arcadia starts with proof, not promises",
    subcaption:
      "A trader can only access investor capital after risking their own junior capital first and proving the vault can survive paper mode.",
    route: "/",
    duration: 6500,
  },

  // ── Phase 2: Trader creates and proves a vault ─────────────────────────────
  {
    id: "connect-trader",
    phase: "trader",
    caption: "Step 1: trader dashboard",
    subcaption:
      "The trader enters operator mode. For the MVP, there is no reputation shortcut: access is earned by posting junior capital and passing vault rules.",
    route: "/manager",
    duration: 5500,
  },
  {
    id: "create-vault-page",
    phase: "trader",
    caption: "Step 2: create a vault with first-loss capital",
    subcaption:
      "The vault starts with strategy name, fee, max slippage, and the trader's junior deposit. Investor capital is still blocked.",
    route: "/manager/create",
    duration: 4000,
  },
  {
    id: "create-vault-submit",
    phase: "trader",
    caption: "Step 3: junior capital is posted",
    subcaption:
      "Arcadia creates the vault and locks 10,000 USDC of trader capital as the first-loss buffer. This is what protects future investors.",
    duration: 5000,
  },
  {
    id: "paper-mode",
    phase: "trader",
    caption: "Step 4: paper mode begins",
    subcaption:
      "No investor funds are at risk yet. The trader must build a live track record while keeping the junior buffer above the graduation threshold.",
    duration: 4000,
  },
  {
    id: "trade-terminal",
    phase: "trader",
    caption: "Step 5: approved spot trading",
    subcaption:
      "The MVP keeps the scope tight: spot flow only, approved assets only, and every action updates NAV and vault health.",
    route: "/trade",
    duration: 5500,
  },
  {
    id: "execute-trades",
    phase: "trader",
    caption: "Step 6: paper trades build the proof trail",
    subcaption:
      "The demo runs a few SOL/USDC paper trades. The important part is not the trade idea, it is the visible effect on NAV and junior buffer health.",
    duration: 7000,
  },
  {
    id: "vault-post-trades",
    phase: "trader",
    caption: "Step 7: vault record is visible",
    subcaption:
      "Now the manager view shows the paper trades, NAV movement, junior health, and activity log in one place.",
    duration: 4500,
  },
  {
    id: "graduate",
    phase: "trader",
    caption: "Step 8: the vault graduates",
    subcaption:
      "After the paper requirements are satisfied and junior capital remains healthy, Arcadia opens the vault to protected investor deposits.",
    duration: 4500,
  },

  // ── Phase 3: Investor enters protected capital ─────────────────────────────
  {
    id: "switch-investor",
    phase: "investor",
    caption: "Step 9: switch to investor view",
    subcaption:
      "The same app now shows what an investor cares about: graduated vaults, junior protection, NAV history, and exit conditions.",
    duration: 2500,
  },
  {
    id: "investor-marketplace",
    phase: "investor",
    caption: "Step 10: browse graduated vaults",
    subcaption:
      "The marketplace is where investor discovery happens. Vaults should be judged by health, capital stack, and proof trail, not hype.",
    route: "/vaults",
    duration: 5000,
  },
  {
    id: "vault-detail",
    phase: "investor",
    caption: "Step 11: inspect the graduated vault",
    subcaption:
      "Before depositing, the investor sees NAV history, senior and junior capital, trade activity, and the first-loss buffer protecting them.",
    duration: 5000,
  },
  {
    id: "deposit",
    phase: "investor",
    caption: "Step 12: deposit senior capital",
    subcaption:
      "The investor deposits as senior capital. If the vault loses money, the trader's junior capital absorbs losses first.",
    duration: 5000,
  },
  {
    id: "portfolio",
    phase: "investor",
    caption: "Step 13: monitor the protected position",
    subcaption:
      "The portfolio closes the loop: live position value, P&L, junior health, alerts, and exit readiness in one dashboard.",
    route: "/portfolio",
    duration: 6000,
  },
];
