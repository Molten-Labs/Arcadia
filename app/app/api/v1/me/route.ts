import { NextResponse } from "next/server";
import { proxyToBackend } from "@/lib/backend-proxy";

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");

  const result = await proxyToBackend("/v1/me", { authHeader });
  if (result.kind === "ok") {
    return NextResponse.json(result.data, { status: result.status });
  }

  // Dev fallback: decode wallet + optional handle/profile from JWT
  let wallet: string | null = null;
  let handle: string | undefined;
  let profile: string | undefined;
  if (authHeader?.startsWith("Bearer ")) {
    try {
      const payload = authHeader.split(".")[1];
      const decoded = JSON.parse(atob(payload));
      wallet = decoded.sub ?? null;
      handle = decoded.handle;
      profile = decoded.profile;
    } catch {}
  }

  if (handle) {
    return NextResponse.json({ role: "trader", wallet, handle, profile }, { status: 200 });
  }

  return NextResponse.json({ role: "investor", wallet }, { status: 200 });
}
