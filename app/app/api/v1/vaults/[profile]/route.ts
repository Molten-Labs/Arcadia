import { NextResponse } from "next/server";
import { getVaultByProfile } from "@/lib/mock-data";
import { proxyToBackend } from "@/lib/backend-proxy";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ profile: string }> },
) {
  const { profile } = await params;
  const result = await proxyToBackend(`/v1/vaults/${profile}`);
  if (result) return NextResponse.json(result.data, { status: result.status });

  const vault = getVaultByProfile(profile);
  if (!vault) {
    return NextResponse.json({ error: "Vault not found" }, { status: 404 });
  }
  return NextResponse.json(vault);
}
