/**
 * GET /api/v1/vaults/[profile]/nav-history
 * Proxies to GET /v1/vaults/:profile/nav-history on the Rust backend.
 * Returns an array of { day, nav, aum_usd }. Empty array when no data.
 */
import { NextResponse } from "next/server";
import { proxyToBackend } from "@/lib/backend-proxy";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ profile: string }> },
) {
  const { profile } = await params;
  const url = new URL(req.url);
  const days = url.searchParams.get("days") ?? "";

  const path = days
    ? `/v1/vaults/${profile}/nav-history?days=${encodeURIComponent(days)}`
    : `/v1/vaults/${profile}/nav-history`;

  const result = await proxyToBackend(path);
  if (result.kind === "ok") {
    const data = Array.isArray(result.data) ? result.data : [];
    return NextResponse.json(data, { status: result.status });
  }
  return NextResponse.json([]);
}