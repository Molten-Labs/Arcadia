/**
 * Backend proxy utility.
 *
 * All Next.js API route handlers use this helper to proxy requests to the
 * Rust Axum backend when BACKEND_URL is configured, and fall back to the
 * mock-data layer otherwise.
 */

const BACKEND_URL = process.env.BACKEND_URL ?? "";

interface ProxyOptions {
  method?: string;
  authHeader?: string | null;
  body?: string;
  headers?: Record<string, string>;
}

export interface ProxyResult {
  data: unknown;
  status: number;
  ok: boolean;
}

/**
 * Proxy a request to the Rust backend.
 * Returns null if BACKEND_URL is not set (signals caller to use mock data).
 */
export async function proxyToBackend(
  path: string,
  opts: ProxyOptions = {},
): Promise<ProxyResult | null> {
  if (!BACKEND_URL) return null;

  const { method = "GET", authHeader, body, headers = {} } = opts;

  try {
    const reqHeaders: Record<string, string> = {
      "Content-Type": "application/json",
      ...headers,
    };
    if (authHeader) reqHeaders["Authorization"] = authHeader;

    const upstream = await fetch(`${BACKEND_URL}${path}`, {
      method,
      headers: reqHeaders,
      ...(body ? { body } : {}),
    });

    const data = await upstream.json().catch(() => ({}));
    return { data, status: upstream.status, ok: upstream.ok };
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ECONNREFUSED") {
      console.warn(`[arcadia] backend not reachable (${BACKEND_URL}) — using mock data`);
    } else {
      console.warn(`[arcadia] backend proxy error for ${path}: ${(err as Error).message}`);
    }
    return null;
  }
}

export function hasBackend(): boolean {
  return Boolean(BACKEND_URL);
}
