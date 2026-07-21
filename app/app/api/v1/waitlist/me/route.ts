import { NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL ?? "";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");

  if (BACKEND_URL) {
    const upstream = await fetch(`${BACKEND_URL}/v1/waitlist/me?token=${token}`, {
      headers: { "Content-Type": "application/json" },
    });
    const data = await upstream.json();
    return NextResponse.json(data, { status: upstream.status });
  }

  return NextResponse.json({
    id: 1,
    email: "demo@arcadia.dev",
    email_verified: true,
    name: "Demo User",
    role: "trader",
    experience: "3+",
    twitter: "@demouser",
    discord: "demo#1234",
    wallet: "Demo1111111111111111111111111111111111111",
    status: "verified",
    referral_code: "DEMO1234",
    position: 42,
    created_at: new Date().toISOString(),
    verified_at: new Date().toISOString(),
  });
}
