import type { PositionView } from "@/hooks/usePositions";
import type { ManagerView, VaultView } from "@/hooks/useVaults";
import type { MarketQuote } from "@/lib/surfpoolDemo";

export interface NavPoint {
  vaultConfigPubkey: string;
  recordedAt: number;
  nav: number;
  juniorCapital: number;
  seniorCapital: number;
}

export interface TradeEvent {
  vaultConfigPubkey: string;
  occurredAt: number;
  visibilityAfter: number;
  isPublicVisible: boolean;
  side: string;
  size: number;
  route?: string | null;
}

export interface StatusEvent {
  vaultConfigPubkey: string;
  occurredAt: number;
  status: string;
  reason?: string | null;
}

export interface CapitalEvent {
  vaultConfigPubkey: string;
  actorRole: "trader" | "investor" | string;
  actor: string;
  action: string;
  amount: number;
  capitalLayer: "junior" | "senior" | string;
  status: "confirmed" | "blocked" | string;
  detail: string;
  occurredAt: number;
}

export interface FeeEvent {
  vaultConfigPubkey: string;
  manager: string;
  highWaterMark: number;
  profitAboveHighWaterMark: number;
  claimableFees: number;
  claimedFees: number;
  feeBps: number;
  detail: string;
  occurredAt: number;
}

export interface RiskEvent {
  vaultConfigPubkey: string;
  state: "healthy" | "caution" | "exit-priority" | "frozen" | string;
  previousState?: string | null;
  juniorBufferRemaining: number;
  juniorBufferUsedPct: number;
  investorCapitalImpacted: number;
  tradingEnabled: boolean;
  reason: string;
  occurredAt: number;
}

export interface DemoStepEvent {
  id: string;
  label: string;
  stage: "active" | "completed" | "failed" | string;
  summary: string;
  actor: "trader" | "investor" | "protocol" | "market" | "operator" | string;
  metric?: string | null;
  occurredAt: number;
}

export interface DemoStorySnapshot {
  running: boolean;
  activeStep?: string | null;
  completedSteps: string[];
  lastStep?: DemoStepEvent | null;
}

export type VaultActivityEvent =
  | { id: string; kind: "capital"; label: string; amount?: number; tone: "success" | "warning" | "danger" | "neutral"; occurredAt: number; detail: string }
  | { id: string; kind: "fee"; label: string; amount?: number; tone: "success" | "warning" | "neutral"; occurredAt: number; detail: string }
  | { id: string; kind: "risk"; label: string; amount?: number; tone: "success" | "warning" | "danger" | "neutral"; occurredAt: number; detail: string }
  | { id: string; kind: "trade"; label: string; amount?: number; tone: "success" | "warning" | "danger" | "neutral"; occurredAt: number; detail: string }
  | { id: string; kind: "status"; label: string; tone: "success" | "warning" | "danger" | "neutral"; occurredAt: number; detail: string };

export type RealtimeEvent =
  | { type: "manager.upsert"; item: ManagerView; receivedAt: number }
  | { type: "vault.upsert"; item: VaultView; receivedAt: number }
  | { type: "position.upsert"; wallet: string; item: PositionView; receivedAt: number }
  | { type: "nav.point"; vaultConfigPubkey: string; item: NavPoint; receivedAt: number }
  | { type: "trade.public"; vaultConfigPubkey: string; item: TradeEvent; receivedAt: number }
  | { type: "status.event"; vaultConfigPubkey: string; item: StatusEvent; receivedAt: number }
  | { type: "deposit.event"; item: CapitalEvent; receivedAt: number }
  | { type: "withdrawal.event"; item: CapitalEvent; receivedAt: number }
  | { type: "fee.event"; item: FeeEvent; receivedAt: number }
  | { type: "risk.event"; item: RiskEvent; receivedAt: number }
  | { type: "market.quote"; item: MarketQuote; receivedAt: number }
  | { type: "demo.step"; item: DemoStepEvent; receivedAt: number }
  | { type: "heartbeat"; receivedAt: number }
  | { type: "resync_required"; topics: string[]; receivedAt: number };

export function eventToActivity(event: RealtimeEvent): VaultActivityEvent | null {
  if (event.type === "deposit.event" || event.type === "withdrawal.event") {
    const blocked = event.item.status === "blocked";
    return {
      id: `${event.type}-${event.item.actor}-${event.item.occurredAt}`,
      kind: "capital",
      label: `${event.item.actorRole === "trader" ? "Trader" : "Investor"} ${event.item.action}`,
      amount: event.item.amount,
      tone: blocked ? "warning" : event.type === "deposit.event" ? "success" : "neutral",
      occurredAt: event.item.occurredAt,
      detail: event.item.detail,
    };
  }

  if (event.type === "fee.event") {
    return {
      id: `fee-${event.item.occurredAt}`,
      kind: "fee",
      label: event.item.claimedFees > 0 ? "Performance fee claimed" : "Fee now claimable",
      amount: event.item.claimedFees || event.item.claimableFees,
      tone: event.item.claimedFees > 0 || event.item.claimableFees > 0 ? "success" : "neutral",
      occurredAt: event.item.occurredAt,
      detail: event.item.detail,
    };
  }

  if (event.type === "risk.event") {
    const tone = event.item.state === "frozen" ? "danger" : event.item.state === "caution" ? "warning" : "success";
    return {
      id: `risk-${event.item.occurredAt}`,
      kind: "risk",
      label: `Risk state: ${event.item.state}`,
      amount: event.item.investorCapitalImpacted,
      tone,
      occurredAt: event.item.occurredAt,
      detail: event.item.reason,
    };
  }

  if (event.type === "trade.public") {
    return {
      id: `trade-${event.item.occurredAt}-${event.item.size}`,
      kind: "trade",
      label: event.item.route ?? "Trade executed",
      amount: event.item.size,
      tone: "neutral",
      occurredAt: event.item.occurredAt,
      detail: "Public trader activity recorded.",
    };
  }

  if (event.type === "market.quote") {
    return {
      id: `quote-${event.item.fetchedAt}`,
      kind: "trade",
      label: "Live Jupiter quote",
      amount: event.item.inputAmount,
      tone: "success",
      occurredAt: event.item.fetchedAt,
      detail: `${event.item.route} quote from ${event.item.quoteSource}; execution remains ${event.item.executionEnv}.`,
    };
  }

  if (event.type === "demo.step") {
    if (event.item.stage !== "completed" && event.item.stage !== "failed") return null;
    return {
      id: `story-${event.item.id}-${event.item.occurredAt}`,
      kind: "status",
      label: event.item.label,
      tone: event.item.stage === "failed" ? "danger" : "success",
      occurredAt: event.item.occurredAt,
      detail: event.item.summary,
    };
  }

  if (event.type === "status.event") {
    const tone = event.item.status === "frozen" ? "danger" : event.item.status === "cooldown" ? "warning" : "neutral";
    return {
      id: `status-${event.item.occurredAt}-${event.item.status}`,
      kind: "status",
      label: `Vault ${event.item.status}`,
      tone,
      occurredAt: event.item.occurredAt,
      detail: event.item.reason ?? "Vault status changed.",
    };
  }

  return null;
}
