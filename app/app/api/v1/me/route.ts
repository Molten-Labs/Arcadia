import { NextResponse } from "next/server";
import { proxyToBackend } from "@/lib/backend-proxy";

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");

  const result = await proxyToBackend("/v1/me", { authHeader });
  if (result.kind === "ok") {
    return NextResponse.json(result.data, { status: result.status });
  }
  // fallback: no backend — return unauthed empty
  return NextResponse.json({ role: "investor", wallet: null }, { status: 200 });
}
