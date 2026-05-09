import { VaultView, ManagerView, PositionView, NavPoint } from './mockData';
import {
  normalizePrivateIntentSnapshot,
  type PrivateIntentSnapshot,
  type SubmitPrivateIntentRequest,
} from './privateIntents';

export const API_BASE = process.env.EXPO_PUBLIC_KILN_API_URL ?? '';

async function get<T>(path: string): Promise<T | null> {
  if (!API_BASE) return null;
  try {
    const res = await fetch(`${API_BASE}${path}`);
    if (!res.ok) throw new Error(`${res.status}`);
    return res.json() as Promise<T>;
  } catch {
    return null;
  }
}

async function post<T>(path: string, body: unknown): Promise<T | null> {
  if (!API_BASE) return null;
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (res.status === 404 || res.status === 405) return null;
    if (!res.ok) throw new Error(`${res.status}`);
    return res.json() as Promise<T>;
  } catch {
    return null;
  }
}

export async function fetchVaults(): Promise<VaultView[] | null> {
  const data = await get<{ items: VaultView[] }>('/vaults');
  return data?.items ?? null;
}

export async function fetchVault(configAddress: string): Promise<VaultView | null> {
  return get<VaultView>(`/vaults/${configAddress}`);
}

export async function fetchManagers(): Promise<ManagerView[] | null> {
  const data = await get<{ items: ManagerView[] }>('/managers');
  return data?.items ?? null;
}

export async function fetchManager(address: string): Promise<ManagerView | null> {
  return get<ManagerView>(`/managers/${address}`);
}

export async function fetchPositions(wallet: string): Promise<PositionView[] | null> {
  const data = await get<{ items: PositionView[] }>(`/positions/${wallet}`);
  return data?.items ?? null;
}

export async function fetchNavHistory(configAddress: string): Promise<NavPoint[] | null> {
  const data = await get<{ items: NavPoint[] }>(`/vaults/${configAddress}/nav-history`);
  return data?.items ?? null;
}

export async function fetchPrivateIntentSnapshot(configAddress: string): Promise<PrivateIntentSnapshot | null> {
  const paths = [
    `/private-intents/vaults/${encodeURIComponent(configAddress)}/snapshot`,
    `/private-intents/vaults/${encodeURIComponent(configAddress)}`,
    `/vaults/${encodeURIComponent(configAddress)}/private-intents`,
  ];
  for (const path of paths) {
    const data = await get<unknown>(path);
    if (data) return normalizePrivateIntentSnapshot(data, configAddress);
  }
  return null;
}

export async function submitPrivateIntent(request: SubmitPrivateIntentRequest): Promise<PrivateIntentSnapshot | null> {
  const body = {
    managerPubkey: request.managerPubkey ?? '11111111111111111111111111111111',
    vaultConfigPubkey: request.vaultConfigPubkey,
    intentType: 'trade.private_intent',
    clientRequestId: request.clientRequestId,
    payload: {
      direction: request.side,
      sizeUsdc: request.amountUsdc,
      routePreference: 'magicblock-er-redacted',
      maxSlippageBps: request.maxSlippageBps,
    },
    proof: {
      privacyMode: 'magicblock-er',
      publicFields: ['commitment', 'guard result', 'risk band', 'settlement'],
    },
  };
  const paths = [
    '/private-intents',
    '/private-intents/submit',
    `/vaults/${encodeURIComponent(request.vaultConfigPubkey)}/private-intents`,
  ];
  for (const path of paths) {
    const data = await post<unknown>(path, body);
    if (data) return normalizePrivateIntentSnapshot(data, request.vaultConfigPubkey);
  }
  return null;
}
