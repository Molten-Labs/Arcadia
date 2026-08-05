/**
 * POST /api/v1/events — proxy on-chain events from the frontend to the Rust backend.
 *
 * When the frontend executes Anchor transactions (deposit, withdraw, initialize profile),
 * it pushes the decoded event data here so the backend's scoring engine has it.
 *
 * Proxies to POST /v1/events on the Rust API. There is no mock fallback: without
 * BACKEND_URL this returns 503. (The ingest worker also reads the chain directly,
 * so these pushes are a best-effort supplement, not the source of truth.)
 */
import { NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL ?? "";

export async function POST(req: Request) {
  const authHeader = req.headers.get("authorization") ?? "";

  if (!BACKEND_URL) {
    return NextResponse.json(
      { error: "Backend not configured" },
      { status: 503 },
    );
  }

  try {
    const body = await req.text();
    const upstream = await fetch(`${BACKEND_URL}/v1/events`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(authHeader ? { Authorization: authHeader } : {}),
      },
      body,
    });
    const data = await upstream.json();
    return NextResponse.json(data, { status: upstream.status });
  } catch {
    return NextResponse.json({ error: "Backend unreachable" }, { status: 502 });
  }
}