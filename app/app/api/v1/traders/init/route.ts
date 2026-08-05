/**
 * POST /api/v1/traders/init — proxy a trader profile creation to the Rust backend.
 *
 * Creates a trader profile for the authenticated wallet. There is no mock
 * fallback: without BACKEND_URL this returns 503.
 */
import { NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL ?? "";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { handle?: string };
  const bearer = req.headers.get("authorization");

  if (!BACKEND_URL) {
    return NextResponse.json(
      { error: "Backend not configured" },
      { status: 503 },
    );
  }

  try {
    const upstream = await fetch(`${BACKEND_URL}/v1/traders/init`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(bearer ? { Authorization: bearer } : {}),
      },
      body: JSON.stringify(body),
    });
    const data = await upstream.json();
    return NextResponse.json(data, { status: upstream.status });
  } catch {
    return NextResponse.json({ error: "Backend unreachable" }, { status: 502 });
  }
}
