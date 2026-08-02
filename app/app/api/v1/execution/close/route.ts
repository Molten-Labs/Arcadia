import { NextResponse } from "next/server";

const SIDECAR_URL = process.env.SIDECAR_URL ?? process.env.NEXT_PUBLIC_SIDECAR_URL ?? "";

/**
 * POST /api/v1/execution/close — proxy to the execution sidecar /trade/close.
 * Returns a real 503 when the sidecar is not configured (never a mock).
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
  const upstream = await fetch(`${SIDECAR_URL}/trade/close`, {
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