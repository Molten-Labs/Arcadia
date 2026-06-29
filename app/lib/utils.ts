import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export function ago(ts: number): string {
  const diff = Math.floor((Date.now() - ts * 1000) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export function nextDailyWindow(now: number = Date.now() / 1000): number {
  const d = new Date((now + 86400) * 1000);
  d.setUTCHours(0, 0, 0, 0);
  return Math.floor(d.getTime() / 1000);
}

export const API_BASE = "/api/v1";

/** Read stored JWT from localStorage (set by useAuth / SIWS flow). */
function getToken(): string | null {
  if (typeof localStorage === "undefined") return null;
  return localStorage.getItem("arcadia_jwt");
}

export async function apiFetch<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const token = getToken();
  const authHeader: Record<string, string> = token
    ? { Authorization: `Bearer ${token}` }
    : {};

  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...authHeader },
    ...options,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`API error ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}
