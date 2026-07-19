/**
 * GET /api/v1/investors/[wallet]/flows
 * Proxies to GET /v1/investors/:wallet/flows on the Rust backend (protected).
 * Returns investor deposit/withdraw flow history. Empty array when no data.
 */
import { NextResponse } from "next/server";
import { proxyToBackend } from "@/lib/backend-proxy";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ wallet: string }> },
) {
  const { wallet } = await params;
  const authHeader = req.headers.get("authorization");
  const url = new URL(req.url);
  const limit = url.searchParams.get("limit") ?? "";

  const path = limit
    ? `/v1/investors/${wallet}/flows?limit=${encodeURIComponent(limit)}`
    : `/v1/investors/${wallet}/flows`;

  const result = await proxyToBackend(path, { authHeader });
  if (result.kind === "ok") {
    const data = Array.isArray(result.data) ? result.data : [];
    return NextResponse.json(data, { status: result.status });
  }
  return NextResponse.json([], { status: 200 });
}