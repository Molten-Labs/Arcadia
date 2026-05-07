import type { PositionView } from "@/hooks/usePositions";
import type { ManagerView, VaultView } from "@/hooks/useVaults";

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
