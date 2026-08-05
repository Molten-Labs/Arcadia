import { NextResponse } from "next/server";
import { proxyToBackend } from "@/lib/backend-proxy";
import { transformVaultInfo } from "@/lib/backend-transform";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ profile: string }> },
) {
  const { profile } = await params;
  const result = await proxyToBackend(`/v1/vaults/${profile}`);
  if (result.kind === "ok" && result.ok) {
    const transformed = transformVaultInfo(result.data);
    return NextResponse.json(transformed);
  }
  return NextResponse.json(
    { error: "Backend unavailable", details: result.kind === "error" ? result.message : undefined },
    { status: result.kind === "error" ? result.status : 503 },
  );
}