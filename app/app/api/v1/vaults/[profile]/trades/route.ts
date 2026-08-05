import { NextResponse } from "next/server";
import { proxyToBackend } from "@/lib/backend-proxy";
import { transformVaultTrades } from "@/lib/backend-transform";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ profile: string }> },
) {
  const { profile } = await params;
  const authHeader = req.headers.get("authorization");
  const result = await proxyToBackend(`/v1/vaults/${profile}/trades`, {
    authHeader,
  });
  if (result.kind === "ok" && result.ok) {
    const transformed = transformVaultTrades(
      Array.isArray(result.data) ? result.data : [],
      profile,
    );
    return NextResponse.json(transformed);
  }
  return NextResponse.json(
    { error: "Backend unavailable", details: result.kind === "error" ? result.message : undefined },
    { status: result.kind === "error" ? result.status : 503 },
  );
}