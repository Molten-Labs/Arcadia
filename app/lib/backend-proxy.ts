/**
 * Backend proxy utility.
 *
 * All Next.js API route handlers use this helper to proxy requests to the
 * Rust Axum backend when BACKEND_URL is configured.
 *
 * Failure semantics:
 *   - BACKEND_URL not set  → returns { kind: "not-configured" }
 *     (callers fall back to mock data — local dev mode)
 *   - fetch throws/errors  → returns { kind: "error", message }
 *     (callers return an empty response, NOT mock data — production must
 *      surface real state even if it's empty)
 *   - success              → returns { kind: "ok", data, status, ok }
 *     (callers use real data, even if it's an empty array)
 */

const BACKEND_URL = process.env.BACKEND_URL ?? "";

interface ProxyOptions {
  method?: string;
  authHeader?: string | null;
  body?: string;
  headers?: Record<string, string>;
}

export type ProxyResult =
  | { kind: "not-configured" }
  | { kind: "error"; status: number; message: string }
  | { kind: "ok"; data: unknown; status: number; ok: boolean };

/**
 * Proxy a request to the Rust backend.
 * Returns a discriminated union so callers can distinguish "no backend
 * configured" (use mock fallback) from "backend configured but failed"
 * (return empty/error response, never mock).
 */
export async function proxyToBackend(
  path: string,
  opts: ProxyOptions = {},
): Promise<ProxyResult> {
  if (!BACKEND_URL) return { kind: "not-configured" };

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
    return { kind: "ok", data, status: upstream.status, ok: upstream.ok };
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    const message =
      code === "ECONNREFUSED"
        ? `backend not reachable (${BACKEND_URL})`
        : (err as Error).message;
    console.warn(`[arcadia] backend proxy error for ${path}: ${message}`);
    return { kind: "error", status: 502, message };
  }
}

export function hasBackend(): boolean {
  return Boolean(BACKEND_URL);
}

/**
 * Helper for route handlers: returns true when the backend is NOT configured
 * (local dev mode) so callers can fall back to mock data. When the backend IS
 * configured but errored, callers should surface the empty/error state
 * instead of substituting mock data.
 */
export function shouldUseMockFallback(result: ProxyResult): boolean {
  return result.kind === "not-configured";
}