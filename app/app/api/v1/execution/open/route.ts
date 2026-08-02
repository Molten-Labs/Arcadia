import { NextResponse } from "next/server";

const SIDECAR_URL = process.env.SIDECAR_URL ?? process.env.NEXT_PUBLIC_SIDECAR_URL ?? "";

/**
 * POST /api/v1/execution/open — proxy to the execution sidecar.
 *
 * Browser-facing route so the terminal never talks to 127.0.0.1 directly.
 * Requests are forwarded verbatim to SIDECAR_URL /trade/open. When no sidecar
 * is configured this returns a real 503 error — the terminal surfaces the
 * failure instead of fabricating a successful trade.
 */
export async function POST(req: Request) {
  if (!SIDECAR_URL) {
    return NextResponse.json(
      { error: "Execution sidecar is not configured (SIDECAR_URL missing)." },
      { status: 503 },
    );
  }

  const authHeader = req.headers.get("authorization") ?? "";
  const body = await req.text();
  const upstream = await fetch(`${SIDECAR_URL}/trade/open`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(authHeader ? { Authorization: authHeader } : {}),
    },
    body,
  });
  const data = await upstream.json().catch(() => ({ error: `Upstream ${upstream.status}` }));
  return NextResponse.json(data, { status: upstream.status });
}