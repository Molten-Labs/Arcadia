import { VaultView, ManagerView, PositionView, NavPoint } from './mockData';

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
