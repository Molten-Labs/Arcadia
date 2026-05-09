import { fetchKilnApiOptional, postKilnApiOptional } from "@/lib/api";

export type PrivateIntentGuardStatus = "online" | "degraded" | "offline" | "unknown";
export type PrivateIntentStageStatus = "pending" | "active" | "complete" | "failed";
export type PrivateIntentResult = "pending" | "approved" | "rejected" | "settled" | "failed";

export interface PrivateIntentGuardState {
  status: PrivateIntentGuardStatus;
  label: string;
  erSession?: string | null;
  validator?: string | null;
  reserveFloorBps: number;
  maxPositionBps?: number | null;
  pendingCount: number;
  approvedCount: number;
  rejectedCount: number;
  lastProofAt?: number | null;
  latencyMs?: number | null;
}

export interface PrivateIntentProofStep {
  id: string;
  label: string;
  status: PrivateIntentStageStatus;
  detail: string;
  occurredAt?: number | null;
  proofHash?: string | null;
  txSignature?: string | null;
}

export interface RedactedPrivateIntentActivity {
  id: string;
  intentId: string;
  vaultConfigPubkey: string;
  occurredAt: number;
  status: PrivateIntentResult;
  side?: string | null;
  amountBucket?: string | null;
  routeCommitment?: string | null;
  guardResult?: "approved" | "rejected" | "pending" | string | null;
  proofHash?: string | null;
  settlementResult?: string | null;
  healthBand?: string | null;
  juniorDelta?: number | null;
  seniorDelta?: number | null;
  revealAt?: number | null;
  detail: string;
  redactedFields: string[];
}

export interface PrivateIntentVaultSnapshot {
  vaultConfigPubkey: string;
  guard: PrivateIntentGuardState;
  timeline: PrivateIntentProofStep[];
  activity: RedactedPrivateIntentActivity[];
  updatedAt?: number | null;
}

export interface SubmitPrivateIntentRequest {
  vaultConfigPubkey: string;
  trader?: string;
  amountUsdc: number;
  side: "USDC_TO_WSOL" | "WSOL_TO_USDC" | string;
  maxSlippageBps?: number;
  clientRequestId?: string;
}

export interface PrivateIntentRealtimeEvent {
  type: `private_intent.${string}` | `privateIntent.${string}` | `private-intent.${string}` | "proof.event";
  vaultConfigPubkey?: string;
  intentId?: string;
  item?: unknown;
  receivedAt?: number;
}

export interface PrivateIntentOnchainProofRequest {
  vaultConfigPubkey: string;
  walletPubkey: string;
  sessionPda: string;
  permissionPda?: string;
  intentCommitment: string;
  proofHash: string;
  erStateRoot: string;
  guardDecision: "approved" | "rejected" | "pending" | string;
  settlementResult: "success" | "loss" | "failed" | "pending" | string;
  healthBand: string;
  positionLimitBps: number;
  juniorDelta: number;
  seniorDelta: number;
  reclaimStatus?: "reclaimed" | "pending-local-callback" | string;
  signatures: {
    init: string;
    delegate: string;
    erExecution: string;
    commit: string;
    undelegate?: string;
  };
  accountOwners?: {
    sessionBefore?: string | null;
    sessionDelegated?: string | null;
    sessionAfter?: string | null;
    permissionDelegated?: string | null;
    vaultState?: string | null;
    treasury?: string | null;
  };
}

const PRIVATE_INTENT_ENDPOINTS = (vaultConfigPubkey: string) => [
  `/private/intents/vault/${encodeURIComponent(vaultConfigPubkey)}`,
  `/vaults/${encodeURIComponent(vaultConfigPubkey)}/private-intents`,
];

const PRIVATE_INTENT_SUBMIT_ENDPOINTS = () => [
  "/private/intents",
  "/private-intents/submit",
];

const DEFAULT_TIMELINE: PrivateIntentProofStep[] = [
  {
    id: "sealed",
    label: "Intent sealed",
    status: "pending",
    detail: "Route, exact size, and timing are committed off public mempool.",
  },
  {
    id: "er-guard",
    label: "MagicBlock ER guard",
    status: "pending",
    detail: "Ephemeral rollup checks reserve floor, cooldown, slippage, and position size.",
  },
  {
    id: "proof",
    label: "Proof posted",
    status: "pending",
    detail: "Only the guard result and proof commitment become public.",
  },
  {
    id: "settlement",
    label: "Vault settlement",
    status: "pending",
    detail: "Treasury state updates after the guard approves the private intent.",
  },
  {
    id: "redacted",
    label: "Redacted activity",
    status: "pending",
    detail: "Investors see auditability without exposing live strategy details.",
  },
];

export function emptyPrivateIntentSnapshot(vaultConfigPubkey: string): PrivateIntentVaultSnapshot {
  return {
    vaultConfigPubkey,
    guard: {
      status: "unknown",
      label: "Waiting for private intent backend",
      reserveFloorBps: 2_000,
      pendingCount: 0,
      approvedCount: 0,
      rejectedCount: 0,
    },
    timeline: DEFAULT_TIMELINE,
    activity: [],
    updatedAt: null,
  };
}

export async function fetchPrivateIntentVaultSnapshot(
  vaultConfigPubkey: string,
): Promise<PrivateIntentVaultSnapshot> {
  for (const path of PRIVATE_INTENT_ENDPOINTS(vaultConfigPubkey)) {
    const data = await fetchKilnApiOptional<unknown>(path);
    if (data) return hydrateProofEvents(normalizePrivateIntentSnapshot(data, vaultConfigPubkey));
  }
  return emptyPrivateIntentSnapshot(vaultConfigPubkey);
}

async function hydrateProofEvents(
  snapshot: PrivateIntentVaultSnapshot,
): Promise<PrivateIntentVaultSnapshot> {
  const proofEvents = (
    await Promise.all(
      snapshot.activity
        .slice(0, 8)
        .map(async (activity) => {
          const data = await fetchKilnApiOptional<{ items: unknown[] }>(
            `/private/intents/${encodeURIComponent(activity.intentId)}/proof-events`,
          );
          return data?.items ?? [];
        }),
    )
  ).flat();
  if (!proofEvents.length) return snapshot;

  return normalizePrivateIntentSnapshot(
    {
      vaultConfigPubkey: snapshot.vaultConfigPubkey,
      guard: snapshot.guard,
      activity: [...snapshot.activity, ...proofEvents],
      proofs: proofEvents,
      updatedAt: snapshot.updatedAt,
    },
    snapshot.vaultConfigPubkey,
  );
}

export async function submitPrivateIntent(
  request: SubmitPrivateIntentRequest,
): Promise<PrivateIntentVaultSnapshot> {
  const body = {
    managerPubkey: request.trader ?? "11111111111111111111111111111111",
    vaultConfigPubkey: request.vaultConfigPubkey,
    intentType: "trade.private_intent",
    clientRequestId: request.clientRequestId,
    payload: {
      direction: request.side,
      sizeUsdc: request.amountUsdc,
      routePreference: "magicblock-er-redacted",
      maxSlippageBps: request.maxSlippageBps,
    },
    proof: {
      privacyMode: "magicblock-er",
      publicFields: ["commitment", "guard result", "risk band", "settlement"],
    },
  };

  for (const path of PRIVATE_INTENT_SUBMIT_ENDPOINTS()) {
    const data = await postKilnApiOptional<unknown>(path, body);
    if (data) return normalizePrivateIntentSnapshot(data, request.vaultConfigPubkey);
  }

  throw new Error("Private intent backend is not available for this vault yet.");
}

export async function recordPrivateIntentOnchainProof(
  intentId: string,
  request: PrivateIntentOnchainProofRequest,
): Promise<PrivateIntentVaultSnapshot | null> {
  const data = await postKilnApiOptional<unknown>(
    `/private/intents/${encodeURIComponent(intentId)}/onchain-proof`,
    request,
  );
  return data ? normalizePrivateIntentSnapshot(data, request.vaultConfigPubkey) : null;
}

export function isPrivateIntentRealtimeEvent(event: { type?: string }): event is PrivateIntentRealtimeEvent {
  const type = event.type ?? "";
  return type === "proof.event" || type.startsWith("private_intent.") || type.startsWith("privateIntent.") || type.startsWith("private-intent.");
}

export function privateIntentRealtimeToSnapshot(
  event: PrivateIntentRealtimeEvent,
): PrivateIntentVaultSnapshot | null {
  const payload = valueRecord(event.item) ?? valueRecord(event);
  const vaultConfigPubkey = stringValue(payload.vaultConfigPubkey) ?? stringValue(event.vaultConfigPubkey);
  if (!vaultConfigPubkey) return null;

  return normalizePrivateIntentSnapshot(
    {
      vaultConfigPubkey,
      guard: payload.guard,
      timeline: payload.timeline ?? payload.proofTimeline ?? payload.proofs,
      activity: [payload],
      updatedAt: numberValue(payload.updatedAt) ?? event.receivedAt,
    },
    vaultConfigPubkey,
  );
}

export function privateIntentRealtimeToActivity(
  event: PrivateIntentRealtimeEvent,
): RedactedPrivateIntentActivity | null {
  const payload = valueRecord(event.item) ?? valueRecord(event);
  const vaultConfigPubkey = stringValue(payload.vaultConfigPubkey) ?? stringValue(event.vaultConfigPubkey);
  if (!vaultConfigPubkey) return null;

  return normalizeRedactedActivity(payload, vaultConfigPubkey, event.receivedAt);
}

export function mergePrivateIntentSnapshot(
  oldSnapshot: PrivateIntentVaultSnapshot | undefined,
  incoming: PrivateIntentVaultSnapshot,
): PrivateIntentVaultSnapshot {
  const base = oldSnapshot ?? emptyPrivateIntentSnapshot(incoming.vaultConfigPubkey);
  const activityById = new Map<string, RedactedPrivateIntentActivity>();
  [...incoming.activity, ...base.activity].forEach((item) => activityById.set(item.id, item));

  const timelineById = new Map<string, PrivateIntentProofStep>();
  [...base.timeline, ...incoming.timeline].forEach((step) => {
    const previous = timelineById.get(step.id);
    timelineById.set(step.id, chooseLaterStep(previous, step));
  });

  return {
    vaultConfigPubkey: incoming.vaultConfigPubkey,
    guard: {
      ...base.guard,
      ...incoming.guard,
      status: incoming.guard.status === "unknown" ? base.guard.status : incoming.guard.status,
    },
    timeline: Array.from(timelineById.values()),
    activity: Array.from(activityById.values())
      .sort((a, b) => b.occurredAt - a.occurredAt)
      .slice(0, 30),
    updatedAt: incoming.updatedAt ?? base.updatedAt ?? null,
  };
}

export function normalizePrivateIntentSnapshot(
  raw: unknown,
  fallbackVaultConfigPubkey: string,
): PrivateIntentVaultSnapshot {
  const data = valueRecord(raw) ?? {};
  const vaultConfigPubkey = stringValue(data.vaultConfigPubkey) ?? fallbackVaultConfigPubkey;
  const guard = normalizeGuard(data.guard, data);
  const activitySource = arrayValue(data.activity)
    ?? arrayValue(data.redactedActivity)
    ?? arrayValue(data.items)
    ?? arrayValue(data.intents)
    ?? (stringValue(data.intentId) ? [data] : undefined)
    ?? [];
  const activity = activitySource.map((item, index) =>
    normalizeRedactedActivity(item, vaultConfigPubkey, guard.lastProofAt ?? undefined, index),
  );
  const approvedFromActivity = activity.filter((item) => item.guardResult === "approved").length;
  const rejectedFromActivity = activity.filter((item) => item.guardResult === "rejected").length;

  const timeline = normalizeTimeline(
    arrayValue(data.timeline) ?? arrayValue(data.proofTimeline) ?? arrayValue(data.proofs),
    activity,
    data,
  );

  return {
    vaultConfigPubkey,
    guard: {
      ...guard,
      approvedCount: Math.max(guard.approvedCount, approvedFromActivity),
      rejectedCount: Math.max(guard.rejectedCount, rejectedFromActivity),
    },
    timeline,
    activity,
    updatedAt: numberValue(data.updatedAt) ?? numberValue(data.receivedAt) ?? guard.lastProofAt ?? null,
  };
}

function normalizeGuard(rawGuard: unknown, data: Record<string, unknown>): PrivateIntentGuardState {
  const guard = valueRecord(rawGuard) ?? {};
  const status = guardStatus(stringValue(guard.status) ?? stringValue(data.guardStatus));
  const pendingCount = numberValue(guard.pendingCount) ?? numberValue(data.pendingCount) ?? 0;
  const approvedCount = numberValue(guard.approvedCount) ?? numberValue(data.approvedCount) ?? 0;
  const rejectedCount = numberValue(guard.rejectedCount) ?? numberValue(data.rejectedCount) ?? 0;
  return {
    status,
    label: stringValue(guard.label) ?? guardLabel(status),
    erSession: stringValue(guard.erSession) ?? stringValue(guard.sessionId) ?? stringValue(data.erSession) ?? null,
    validator: stringValue(guard.validator) ?? stringValue(guard.operator) ?? null,
    reserveFloorBps: numberValue(guard.reserveFloorBps) ?? numberValue(data.reserveFloorBps) ?? 2_000,
    maxPositionBps: numberValue(guard.maxPositionBps) ?? numberValue(data.maxPositionBps) ?? null,
    pendingCount,
    approvedCount,
    rejectedCount,
    lastProofAt: numberValue(guard.lastProofAt) ?? numberValue(data.lastProofAt) ?? numberValue(data.occurredAt) ?? null,
    latencyMs: numberValue(guard.latencyMs) ?? numberValue(data.latencyMs) ?? null,
  };
}

function normalizeTimeline(
  rawTimeline: unknown[] | undefined,
  activity: RedactedPrivateIntentActivity[],
  data: Record<string, unknown>,
): PrivateIntentProofStep[] {
  if (rawTimeline?.length) {
    return rawTimeline.map((item, index) => normalizeStep(item, index));
  }

  const latest = activity[0];
  const stage = stringValue(data.stage) ?? stringValue(data.status) ?? latest?.status;
  const proofHash = stringValue(data.proofHash) ?? latest?.proofHash ?? null;
  return DEFAULT_TIMELINE.map((step) => ({
    ...step,
    status: inferStepStatus(step.id, stage, latest?.guardResult),
    occurredAt: latest?.occurredAt ?? null,
    proofHash: step.id === "proof" ? proofHash : null,
  }));
}

function normalizeStep(raw: unknown, index: number): PrivateIntentProofStep {
  const data = valueRecord(raw) ?? {};
  const fallback = DEFAULT_TIMELINE[index] ?? DEFAULT_TIMELINE[DEFAULT_TIMELINE.length - 1];
  return {
    id: stringValue(data.id) ?? stringValue(data.stage) ?? fallback.id,
    label: stringValue(data.label) ?? fallback.label,
    status: stepStatus(stringValue(data.status)) ?? fallback.status,
    detail: stringValue(data.detail) ?? stringValue(data.summary) ?? fallback.detail,
    occurredAt: numberValue(data.occurredAt) ?? numberValue(data.completedAt) ?? null,
    proofHash: stringValue(data.proofHash) ?? stringValue(data.commitment) ?? null,
    txSignature: stringValue(data.txSignature) ?? stringValue(data.signature) ?? null,
  };
}

function normalizeRedactedActivity(
  raw: unknown,
  vaultConfigPubkey: string,
  fallbackTime?: number,
  index = 0,
): RedactedPrivateIntentActivity {
  const data = valueRecord(raw) ?? {};
  const redactedPayload = valueRecord(data.redactedPayload)
    ?? valueRecord(data.redacted_payload)
    ?? valueRecord(data.redactedResponse)
    ?? valueRecord(data.redacted_response)
    ?? {};
  const riskLimits = valueRecord(data.riskLimits) ?? valueRecord(redactedPayload.riskLimits) ?? {};
  const balanceImpact = valueRecord(data.balanceImpact) ?? valueRecord(redactedPayload.balanceImpact) ?? {};
  const guardDecision =
    stringValue(data.guardDecision)
    ?? stringValue(redactedPayload.guardDecision)
    ?? stringValue(data.guardResult);
  const settlementResult =
    stringValue(data.settlementResult)
    ?? stringValue(redactedPayload.settlementResult)
    ?? stringValue(data.result);
  const intentId = stringValue(data.intentId) ?? stringValue(data.id) ?? `intent-${fallbackTime ?? Date.now()}-${index}`;
  const occurredAt = numberValue(data.occurredAt) ?? numberValue(data.receivedAt) ?? fallbackTime ?? Math.floor(Date.now() / 1000);
  const result = intentResult(
    stringValue(data.status)
      ?? settlementResult
      ?? guardDecision
      ?? stringValue(redactedPayload.status),
  );
  const guardResult = guardDecision ?? (result === "approved" || result === "rejected" ? result : "pending");
  const redactedFields = stringArray(data.redactedFields).length
    ? stringArray(data.redactedFields)
    : stringArray(redactedPayload.redactedFields);

  return {
    id: `${intentId}-${occurredAt}`,
    intentId,
    vaultConfigPubkey: stringValue(data.vaultConfigPubkey) ?? vaultConfigPubkey,
    occurredAt,
    status: result,
    side: stringValue(data.side) ?? stringValue(data.direction) ?? null,
    amountBucket: stringValue(data.amountBucket) ?? stringValue(data.sizeBucket) ?? stringValue(riskLimits.requestedNotionalBand) ?? "redacted",
    routeCommitment: stringValue(data.routeCommitment) ?? stringValue(data.routeHash) ?? stringValue(data.commitment) ?? stringValue(data.commitmentHash) ?? stringValue(redactedPayload.commitmentHash) ?? null,
    guardResult,
    proofHash: stringValue(data.proofHash) ?? stringValue(data.guardProofHash) ?? stringValue(data.erCommitment) ?? stringValue(data.commitmentHash) ?? stringValue(redactedPayload.proofHash) ?? null,
    settlementResult,
    healthBand: stringValue(data.healthBand) ?? stringValue(riskLimits.healthBand) ?? null,
    juniorDelta: numberValue(data.juniorDelta) ?? numberValue(balanceImpact.juniorDelta) ?? null,
    seniorDelta: numberValue(data.seniorDelta) ?? numberValue(balanceImpact.seniorDelta) ?? null,
    revealAt: numberValue(data.revealAt) ?? numberValue(data.visibilityAfter) ?? null,
    detail: stringValue(data.detail) ?? stringValue(data.summary) ?? stringValue(redactedPayload.publicSummary) ?? detailForResult(result),
    redactedFields: redactedFields.length ? redactedFields : ["route", "exact size", "execution slot"],
  };
}

function inferStepStatus(
  stepId: string,
  stage?: string | null,
  guardResult?: string | null,
): PrivateIntentStageStatus {
  const normalized = (stage ?? "").toLowerCase();
  const guard = (guardResult ?? "").toLowerCase();
  if (normalized.includes("fail") || normalized.includes("reject") || guard.includes("reject")) {
    return stepId === "er-guard" || stepId === "proof" ? "failed" : stepId === "sealed" ? "complete" : "pending";
  }
  const order = ["sealed", "er-guard", "proof", "settlement", "redacted"];
  const activeIndex = normalized.includes("settle")
    ? 3
    : normalized.includes("proof") || normalized.includes("approved")
      ? 2
      : normalized.includes("guard")
        ? 1
        : normalized.includes("accepted") || normalized.includes("submitted")
          ? 1
          : normalized.includes("sealed") || normalized.includes("pending")
            ? 0
          : -1;
  const stepIndex = order.indexOf(stepId);
  if (activeIndex === -1) return "pending";
  if (stepIndex < activeIndex) return "complete";
  if (stepIndex === activeIndex) return normalized.includes("settled") ? "complete" : "active";
  return "pending";
}

function chooseLaterStep(
  previous: PrivateIntentProofStep | undefined,
  next: PrivateIntentProofStep,
): PrivateIntentProofStep {
  if (!previous) return next;
  const rank = { pending: 0, active: 1, failed: 2, complete: 3 } satisfies Record<PrivateIntentStageStatus, number>;
  return rank[next.status] >= rank[previous.status] ? { ...previous, ...next } : previous;
}

function valueRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function arrayValue(value: unknown): unknown[] | undefined {
  return Array.isArray(value) ? value : undefined;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function numberValue(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function guardStatus(value?: string): PrivateIntentGuardStatus {
  const normalized = (value ?? "").toLowerCase();
  if (["online", "healthy", "ready"].includes(normalized)) return "online";
  if (["degraded", "lagging", "warning"].includes(normalized)) return "degraded";
  if (["offline", "disabled", "unavailable"].includes(normalized)) return "offline";
  return "unknown";
}

function stepStatus(value?: string): PrivateIntentStageStatus | undefined {
  const normalized = (value ?? "").toLowerCase();
  if (["pending", "queued"].includes(normalized)) return "pending";
  if (["active", "running", "processing", "accepted", "submitted"].includes(normalized)) return "active";
  if (["complete", "completed", "approved", "settled"].includes(normalized)) return "complete";
  if (["failed", "rejected", "error"].includes(normalized)) return "failed";
  return undefined;
}

function intentResult(value?: string): PrivateIntentResult {
  const normalized = (value ?? "").toLowerCase();
  if (normalized.includes("reject")) return "rejected";
  if (normalized.includes("settle")) return "settled";
  if (normalized.includes("approve")) return "approved";
  if (normalized.includes("fail") || normalized.includes("error")) return "failed";
  return "pending";
}

function guardLabel(status: PrivateIntentGuardStatus): string {
  if (status === "online") return "MagicBlock ER guard online";
  if (status === "degraded") return "Guard delayed, proofs still tracked";
  if (status === "offline") return "Private intent guard offline";
  return "Waiting for private intent backend";
}

function detailForResult(result: PrivateIntentResult): string {
  if (result === "approved") return "Vault guard approved a private intent. Route and exact size remain redacted.";
  if (result === "rejected") return "Vault guard rejected a private intent before settlement.";
  if (result === "settled") return "Private intent settled with a public proof commitment.";
  if (result === "failed") return "Private intent failed before settlement.";
  return "Private intent sealed; awaiting guard proof.";
}
