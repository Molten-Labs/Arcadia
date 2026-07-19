import { NextResponse } from "next/server";
import { getVaultByProfile } from "@/lib/mock-data";
import { proxyToBackend, shouldUseMockFallback } from "@/lib/backend-proxy";
import { transformVaultInfo } from "@/lib/backend-transform";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ profile: string }> },
) {
  const { profile } = await params;
  const result = await proxyToBackend(`/v1/vaults/${profile}`);
  if (result.kind === "ok" && result.ok) {
    const transformed = transformVaultInfo(
      result.data,
      getVaultByProfile(profile) ?? undefined,
    );
    return NextResponse.json(transformed);
  }
  if (shouldUseMockFallback(result)) {
    const vault = getVaultByProfile(profile);
    if (!vault) {
      return NextResponse.json({ error: "Vault not found" }, { status: 404 });
    }
    return NextResponse.json(vault);
  }
  return NextResponse.json(
    { error: "Vault not found", details: result.kind === "error" ? result.message : undefined },
    { status: result.kind === "error" ? result.status : 404 },
  );
}