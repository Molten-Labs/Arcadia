export interface ApiItems<T> {
  items: T[];
}

export function getKilnApiUrl(): string {
  return (import.meta.env.VITE_KILN_API_URL || import.meta.env.VITE_KILN_API_BASE_URL || "").replace(
    /\/$/,
    ""
  );
}

export function getArcadiaRealtimeUrl(): string {
  const baseUrl = getKilnApiUrl();
  if (!baseUrl) return "";
  return `${baseUrl.replace(/^http:/, "ws:").replace(/^https:/, "wss:")}/live`;
}

export function isArcadiaDemoMode(): boolean {
  const value = import.meta.env.VITE_ARCADIA_DEMO_MODE;
  return value === "1" || String(value).toLowerCase() === "true";
}

export function isArcadiaSurfpoolMode(): boolean {
  return String(import.meta.env.VITE_ARCADIA_EXECUTION_ENV || "").toLowerCase() === "surfpool";
}

export function isArcadiaDevnetProductMode(): boolean {
  const executionEnv = String(import.meta.env.VITE_ARCADIA_EXECUTION_ENV || "").toLowerCase();
  const cluster = String(import.meta.env.VITE_SOLANA_CLUSTER || "").toLowerCase();
  return !isArcadiaDemoMode() && (executionEnv === "devnet" || cluster === "devnet");
}

export async function fetchKilnApi<T>(path: string): Promise<T | null> {
  const baseUrl = getKilnApiUrl();
  if (!baseUrl) return null;

  try {
    const response = await fetch(`${baseUrl}${path}`);
    if (!response.ok) {
      throw new Error(`Arcadia API request failed: ${response.status}`);
    }
    return response.json() as Promise<T>;
  } catch (error) {
    // Log the error for debugging but allow graceful fallback
    console.error(`Failed to fetch from Arcadia API at ${baseUrl}${path}:`, error);
    throw error;
  }
}

export async function postKilnApi<T>(path: string, body?: unknown): Promise<T | null> {
  const baseUrl = getKilnApiUrl();
  if (!baseUrl) return null;

  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: body === undefined ? undefined : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`Arcadia API request failed: ${response.status}`);
  }
  return response.json() as Promise<T>;
}
