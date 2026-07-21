// Static landing content. Hoisted to module scope so server components import
// it once (no per-render allocation). Copy is canonical from the acid comp.
// Plain ASCII only.

import type { ScoreTier } from "@/lib/types";

/** Primary marketing routes reused across nav, footer, and CTAs. */
export const LINKS = {
  home: "/",
  traders: "/traders",
  leaderboard: "/leaderboard",
  terminal: "/terminal",
  waitlist: "/waitlist",
  docs: "#",
} as const;

export const NAV_LINKS = [
  { label: "Traders", href: LINKS.traders },
  { label: "Leaderboard", href: LINKS.leaderboard },
  { label: "Demo", href: LINKS.terminal },
] as const;

/** Trust-strip marquee tokens. `icon` keys map to marks in TrustStrip. */
export const TRUST_ITEMS = [
  { label: "Solana", icon: "solana" },
  { label: "Drift", icon: "drift" },
  { label: "Jupiter", icon: "jupiter" },
  { label: "Verified reputation", icon: "verified" },
  { label: "Smart-contract allocation", icon: "contract" },
  { label: "Non-custodial vaults", icon: "vault" },
] as const;

/** Diagonal acid band phrases. */
export const SLASH_PHRASES = [
  "PROOF REPLACES PROMISES",
  "VERIFIED ON-CHAIN",
  "NON-CUSTODIAL VAULTS",
  "TECHNO SURREALISM",
  "SOLANA",
] as const;

/** Footer marquee phrases. */
export const FOOTER_PHRASES = [
  "PROOF REPLACES PROMISES",
  "VERIFIED ON-CHAIN",
  "NON-CUSTODIAL VAULTS",
  "SOLANA",
] as const;

export const PROBLEMS = [
  {
    tag: "FOR TRADERS",
    accent: "acid" as const,
    heading: "The talent is real. The proof isn't portable.",
    body: "A trader can be genuinely talented and still have no trusted way to show it. Screenshots can be edited. Private dashboards don't travel.",
    points: [
      "Real performance is hard to separate from lucky wins",
      "Screenshots and P&L claims are easy to fake",
      "Small traders struggle to earn access to larger capital",
    ],
  },
  {
    tag: "FOR INVESTORS",
    accent: "cyan" as const,
    heading: "Everyone claims alpha. Nobody can verify it.",
    body: "Investors want exposure to skilled traders, but the internet is full of claims. Without a verified record and safe structure, backing a trader is guesswork.",
    points: [
      "No simple way to verify claimed performance",
      "No clear reputation layer for on-chain traders",
      "No safe reason to send capital directly to a stranger",
    ],
  },
] as const;

export const ALLOCATION_SPECS = [
  { label: "Investor capital held by", value: "Smart-contract vault" },
  { label: "Trader access", value: "Trading permissions" },
  { label: "Trader withdrawal", value: "Performance share only" },
  { label: "Investor visibility", value: "Score, vault, and activity" },
  { label: "Allocation logic", value: "Reputation-based capacity" },
  { label: "Protected against", value: "Theft -- not trading losses" },
] as const;

export const HOW_STEPS = [
  {
    n: "01",
    title: "A trader connects their wallet",
    body: "Arcadia reads public on-chain history and turns raw activity into a clear performance record.",
    wide: false,
  },
  {
    n: "02",
    title: "Arcadia builds a reputation score",
    body: "Measures consistency, risk control, drawdown, and real performance -- not screenshots or hype.",
    wide: false,
  },
  {
    n: "03",
    title: "The trader opens a vault",
    body: "They start with their own capital first, creating skin in the game before outside investors allocate.",
    wide: false,
  },
  {
    n: "04",
    title: "Capital follows proven skill",
    body: "As reputation improves, investors can deposit; higher trust unlocks more allocation capacity.",
    wide: false,
  },
  {
    n: "05",
    title: "Profits are shared on-chain",
    body: "New profit means the trader earns a performance share, investors participate in upside, and Arcadia earns its fees.",
    wide: true,
  },
] as const;

export const WEEK_TRACK = [
  { label: "Week 1", score: 340, pct: 34, peak: false },
  { label: "Week 4", score: 580, pct: 58, peak: false },
  { label: "Week 8", score: 740, pct: 74, peak: false },
  { label: "Week 12", score: 912, pct: 91.2, peak: true },
] as const;

export const SCORE_BREAKDOWN = [
  { label: "Risk-adjusted return", weight: 30, value: 91 },
  { label: "Consistency", weight: 25, value: 88 },
  { label: "Drawdown control", weight: 25, value: 72 },
  { label: "Track record depth", weight: 20, value: 84 },
] as const;

type TierKey = "verified" | "established" | "advanced" | "elite";

export const TIERS: {
  key: TierKey;
  name: string;
  criteria: string;
  share: string;
}[] = [
  { key: "verified", name: "Verified", criteria: "All scores", share: "20% profit share" },
  { key: "established", name: "Established", criteria: "Score >= 700", share: "25%" },
  { key: "advanced", name: "Advanced", criteria: "Score >= 800", share: "30%" },
  { key: "elite", name: "Elite", criteria: "Score >= 900", share: "35%" },
];

export const TWO_SIDES = {
  traders: {
    intro: "Turn your real trading history into a reputation investors can understand.",
    accent: "acid" as const,
    steps: [
      { n: "1", title: "Connect your wallet", body: "Arcadia reads your on-chain history into a reputation profile." },
      { n: "2", title: "Fund your own vault", body: "Start with your own capital; show skin in the game." },
      { n: "3", title: "Build your score", body: "Consistent, risk-aware performance raises your Arcadia Score." },
      { n: "4", title: "Earn allocated capital", body: "As investors back you, you manage more and earn a profit share." },
    ],
    cta: { label: "Try the demo", href: LINKS.terminal },
  },
  investors: {
    intro: "Back traders based on proof, not promises.",
    accent: "cyan" as const,
    steps: [
      { n: "1", title: "Browse verified traders", body: "Compare by score, record, tier, strategy, and vault size." },
      { n: "2", title: "Choose who to back", body: "Deposit into a vault, not a stranger's wallet." },
      { n: "3", title: "Track the record", body: "Follow vault activity, score changes, and performance in one dashboard." },
      { n: "4", title: "Share in the upside", body: "When the trader profits, investors participate through the vault." },
    ],
    cta: { label: "Join waitlist", href: LINKS.waitlist },
  },
} as const;

export const FAQ_ITEMS = [
  {
    q: "What is Arcadia?",
    a: "The allocation rail for on-chain trading talent. It turns real trading history into verified reputation, then lets investor capital flow to traders through smart-contract vaults instead of screenshots or direct custody.",
  },
  {
    q: "What is the Arcadia Score?",
    a: "A 0-1000 reputation number built from real trading history. It rewards consistent, risk-aware performance, not loud claims or lucky screenshots.",
  },
  {
    q: "Can a trader fake their reputation?",
    a: "No. Arcadia is based on on-chain trading activity, not uploaded screenshots. Reputation comes from the public record.",
  },
  {
    q: "Can a trader run away with investor funds?",
    a: "No. Investor capital goes into a smart-contract vault, not the trader's wallet. They can trade under protocol rules but cannot withdraw investor capital.",
  },
  {
    q: "Can I lose money as an investor?",
    a: "Yes. Arcadia protects you from theft, not from trading losses. You hold vault shares alongside the trader; if the vault loses, your share loses value proportionally. Verified skill lowers risk over time; it does not remove it.",
  },
  {
    q: "How does Arcadia make money?",
    a: "A share of profit when a vault performs, plus a small ongoing management fee, so the protocol stays funded in any market.",
  },
] as const;

export const DUAL_CTA = [
  {
    accent: "acid" as const,
    heading: "Turn your record into allocated capital.",
    body: "Stop proving yourself with screenshots. Build a reputation from real on-chain trades and let capital find you.",
    cta: { label: "Try the demo", href: LINKS.terminal, variant: "acid" as const },
  },
  {
    accent: "cyan" as const,
    heading: "Get early access.",
    body: "Arcadia is in private beta. Join the waitlist and be first to know when vaults open.",
    cta: { label: "Join waitlist", href: LINKS.waitlist, variant: "chrome" as const },
  },
];

/** Tier dot background classes (token-driven, no raw hex). */
export const TIER_DOT: Record<TierKey, string> = {
  verified: "bg-tier-verified",
  established: "bg-tier-established",
  advanced: "bg-tier-advanced",
  elite: "bg-tier-elite",
};

/** Map an API tier label to the Badge/tier-token key. */
export function tierKey(tier: ScoreTier): TierKey {
  return tier.toLowerCase() as TierKey;
}
