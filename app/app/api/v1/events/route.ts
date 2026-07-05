/**
 * POST /api/v1/events — proxy on-chain events from the frontend to the Rust backend.
 *
 * When the frontend executes Anchor transactions (deposit, withdraw, initialize profile),
 * it pushes the decoded event data here so the backend's scoring engine has it.
 *
 * With BACKEND_URL set, this proxies to POST /v1/events on the Rust API.
 * Without BACKEND_URL, it returns a mock acceptance response.
 */
import { NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL ?? "";

export async function POST(req: Request) {
  const authHeader = req.headers.get("authorization") ?? "";

  if (BACKEND_URL) {
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
  }

  // Mock acceptance
  const body = await req.json().catch(() => ({})) as { events?: unknown[] };
  const count = body.events?.length ?? 0;

  return NextResponse.json({
    accepted: count,
    errors: [],
  });
}
