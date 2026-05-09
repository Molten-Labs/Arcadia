export type PrivateIntentStage = 'pending' | 'active' | 'complete' | 'failed';

export interface PrivateIntentStep {
  id: string;
  label: string;
  status: PrivateIntentStage;
  detail: string;
}

export interface PrivateIntentActivity {
  id: string;
  intentId: string;
  vaultConfigPubkey: string;
  occurredAt: number;
  status: 'pending' | 'approved' | 'rejected' | 'settled' | 'failed';
  amountBucket: string;
  routeCommitment?: string | null;
  guardResult: string;
  detail: string;
}

export interface PrivateIntentSnapshot {
  vaultConfigPubkey: string;
  guardStatus: 'online' | 'degraded' | 'offline' | 'unknown';
  guardLabel: string;
  pendingCount: number;
  approvedCount: number;
  rejectedCount: number;
  latencyMs?: number | null;
  timeline: PrivateIntentStep[];
  activity: PrivateIntentActivity[];
}

export interface SubmitPrivateIntentRequest {
  vaultConfigPubkey: string;
  managerPubkey?: string;
  amountUsdc: number;
  side: 'USDC_TO_WSOL' | 'WSOL_TO_USDC' | string;
  maxSlippageBps?: number;
  clientRequestId?: string;
}

const DEFAULT_TIMELINE: PrivateIntentStep[] = [
  { id: 'sealed', label: 'Intent sealed', status: 'pending', detail: 'Route, exact size, and slot stay private.' },
  { id: 'guard', label: 'ER guard proof', status: 'pending', detail: 'MagicBlock ephemeral rollup checks vault rules.' },
  { id: 'settlement', label: 'Settlement', status: 'pending', detail: 'Approved intents settle back into vault state.' },
  { id: 'redacted', label: 'Redacted activity', status: 'pending', detail: 'Investors see proof without seeing strategy.' },
];

export function emptyPrivateIntentSnapshot(vaultConfigPubkey: string): PrivateIntentSnapshot {
  return {
    vaultConfigPubkey,
    guardStatus: 'unknown',
    guardLabel: 'Private intent backend pending',
    pendingCount: 0,
    approvedCount: 0,
    rejectedCount: 0,
    latencyMs: null,
    timeline: DEFAULT_TIMELINE,
    activity: [],
  };
}

export function mockPrivateIntentSnapshot(vaultConfigPubkey: string): PrivateIntentSnapshot {
  const now = Math.floor(Date.now() / 1000);
  return {
    vaultConfigPubkey,
    guardStatus: 'online',
    guardLabel: 'MagicBlock ER guard online',
    pendingCount: 1,
    approvedCount: 6,
    rejectedCount: 0,
    latencyMs: 92,
    timeline: [
      { ...DEFAULT_TIMELINE[0], status: 'complete' },
      { ...DEFAULT_TIMELINE[1], status: 'active' },
      DEFAULT_TIMELINE[2],
      DEFAULT_TIMELINE[3],
    ],
    activity: [
      {
        id: `mock-${vaultConfigPubkey}-${now}`,
        intentId: 'mock-intent',
        vaultConfigPubkey,
        occurredAt: now,
        status: 'pending',
        amountBucket: '1k-5k USDC',
        routeCommitment: 'route-redacted',
        guardResult: 'pending',
        detail: 'Intent sealed. Route and exact size are redacted until proof release.',
      },
    ],
  };
}

export function normalizePrivateIntentSnapshot(raw: unknown, fallbackVaultConfigPubkey: string): PrivateIntentSnapshot {
  const data = record(raw) ?? {};
  const vaultConfigPubkey = str(data.vaultConfigPubkey) ?? fallbackVaultConfigPubkey;
  const guard = record(data.guard) ?? {};
  const status = guardStatus(str(guard.status) ?? str(data.guardStatus));
  const activitySource = arr(data.activity)
    ?? arr(data.redactedActivity)
    ?? arr(data.items)
    ?? (str(data.intentId) ? [data] : undefined)
    ?? [];
  const activity = activitySource.map((item, index) => normalizeActivity(item, vaultConfigPubkey, index));
  const timelineSource = arr(data.timeline) ?? arr(data.proofTimeline);

  return {
    vaultConfigPubkey,
    guardStatus: status,
    guardLabel: str(guard.label) ?? guardLabel(status),
    pendingCount: num(guard.pendingCount) ?? num(data.pendingCount) ?? 0,
    approvedCount: num(guard.approvedCount) ?? num(data.approvedCount) ?? 0,
    rejectedCount: num(guard.rejectedCount) ?? num(data.rejectedCount) ?? 0,
    latencyMs: num(guard.latencyMs) ?? num(data.latencyMs) ?? null,
    timeline: timelineSource?.length ? timelineSource.map((item, index) => normalizeStep(item, index)) : inferTimeline(activity),
    activity,
  };
}

function normalizeStep(raw: unknown, index: number): PrivateIntentStep {
  const data = record(raw) ?? {};
  const fallback = DEFAULT_TIMELINE[index] ?? DEFAULT_TIMELINE[DEFAULT_TIMELINE.length - 1];
  return {
    id: str(data.id) ?? str(data.stage) ?? fallback.id,
    label: str(data.label) ?? fallback.label,
    status: stage(str(data.status)) ?? fallback.status,
    detail: str(data.detail) ?? str(data.summary) ?? fallback.detail,
  };
}

function normalizeActivity(raw: unknown, vaultConfigPubkey: string, index: number): PrivateIntentActivity {
  const data = record(raw) ?? {};
  const now = Math.floor(Date.now() / 1000);
  const intentId = str(data.intentId) ?? str(data.id) ?? `intent-${now}-${index}`;
  const status = result(str(data.status) ?? str(data.result) ?? str(data.guardResult));
  return {
    id: `${intentId}-${num(data.occurredAt) ?? now}`,
    intentId,
    vaultConfigPubkey: str(data.vaultConfigPubkey) ?? vaultConfigPubkey,
    occurredAt: num(data.occurredAt) ?? num(data.receivedAt) ?? now,
    status,
    amountBucket: str(data.amountBucket) ?? str(data.sizeBucket) ?? str(record(data.riskLimits)?.requestedNotionalBand) ?? 'redacted',
    routeCommitment: str(data.routeCommitment) ?? str(data.routeHash) ?? str(data.commitmentHash) ?? null,
    guardResult: str(data.guardResult) ?? (status === 'approved' || status === 'rejected' ? status : 'pending'),
    detail: str(data.detail) ?? detail(status),
  };
}

function inferTimeline(activity: PrivateIntentActivity[]): PrivateIntentStep[] {
  const latest = activity[0];
  if (!latest) return DEFAULT_TIMELINE;
  const activeIndex = latest.status === 'settled' ? 3 : latest.status === 'approved' ? 2 : latest.status === 'pending' ? 1 : 1;
  return DEFAULT_TIMELINE.map((step, index) => ({
    ...step,
    status: index < activeIndex ? 'complete' : index === activeIndex ? (latest.status === 'rejected' || latest.status === 'failed' ? 'failed' : 'active') : 'pending',
  }));
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function arr(value: unknown): unknown[] | undefined {
  return Array.isArray(value) ? value : undefined;
}

function str(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function num(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function guardStatus(value?: string): PrivateIntentSnapshot['guardStatus'] {
  const normalized = (value ?? '').toLowerCase();
  if (['online', 'healthy', 'ready'].includes(normalized)) return 'online';
  if (['degraded', 'lagging', 'warning'].includes(normalized)) return 'degraded';
  if (['offline', 'disabled', 'unavailable'].includes(normalized)) return 'offline';
  return 'unknown';
}

function stage(value?: string): PrivateIntentStage | undefined {
  const normalized = (value ?? '').toLowerCase();
  if (['pending', 'queued'].includes(normalized)) return 'pending';
  if (['active', 'running', 'processing'].includes(normalized)) return 'active';
  if (['complete', 'completed', 'approved', 'settled'].includes(normalized)) return 'complete';
  if (['failed', 'rejected', 'error'].includes(normalized)) return 'failed';
  return undefined;
}

function result(value?: string): PrivateIntentActivity['status'] {
  const normalized = (value ?? '').toLowerCase();
  if (normalized.includes('reject')) return 'rejected';
  if (normalized.includes('settle')) return 'settled';
  if (normalized.includes('approve')) return 'approved';
  if (normalized.includes('fail') || normalized.includes('error')) return 'failed';
  return 'pending';
}

function guardLabel(status: PrivateIntentSnapshot['guardStatus']) {
  if (status === 'online') return 'MagicBlock ER guard online';
  if (status === 'degraded') return 'Guard delayed, proofs tracked';
  if (status === 'offline') return 'Private intent guard offline';
  return 'Private intent backend pending';
}

function detail(status: PrivateIntentActivity['status']) {
  if (status === 'approved') return 'Vault guard approved this private intent.';
  if (status === 'rejected') return 'Vault guard rejected this private intent before settlement.';
  if (status === 'settled') return 'Private intent settled with a public proof commitment.';
  if (status === 'failed') return 'Private intent failed before settlement.';
  return 'Intent sealed. Route and exact size remain redacted.';
}
