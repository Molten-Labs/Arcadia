import { NextResponse } from "next/server";
import { proxyToBackend } from "@/lib/backend-proxy";

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");

  const result = await proxyToBackend("/v1/me", { authHeader });
  if (result.kind === "ok") {
    return NextResponse.json(result.data, { status: result.status });
  }

  // Dev fallback: decode wallet from the JWT if present
  let wallet: string | null = null;
  if (authHeader?.startsWith("Bearer ")) {
    try {
      const payload = authHeader.split(".")[1];
      const decoded = JSON.parse(atob(payload));
      wallet = decoded.sub ?? null;
    } catch {}
  }

  return NextResponse.json({ role: "investor", wallet }, { status: 200 });
}
