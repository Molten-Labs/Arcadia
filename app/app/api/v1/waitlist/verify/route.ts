import { NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL ?? "";

export async function POST(req: Request) {
  const body = await req.text();

  if (BACKEND_URL) {
    const upstream = await fetch(`${BACKEND_URL}/v1/waitlist/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });
    const data = await upstream.json();
    return NextResponse.json(data, { status: upstream.status });
  }

  const parsed = JSON.parse(body) as { token?: string };
  if (!parsed.token) {
    return NextResponse.json({ error: { code: "BAD_REQUEST", message: "Missing token" } }, { status: 400 });
  }

  const jwt = "dev-jwt-" + parsed.token;
  return NextResponse.json({
    ok: true,
    token: jwt,
    user: { id: 1, email: "demo@arcadia.dev", role: "trader", referral_code: "DEMO1234" },
  });
}
