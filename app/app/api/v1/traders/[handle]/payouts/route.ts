import { NextResponse } from "next/server";
import { proxyToBackend } from "@/lib/backend-proxy";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ handle: string }> },
) {
  const { handle } = await params;
  const url = new URL(req.url);
  const limit = url.searchParams.get("limit") ?? "";

  const path = limit
    ? `/v1/traders/${handle}/payouts?limit=${encodeURIComponent(limit)}`
    : `/v1/traders/${handle}/payouts`;

  const result = await proxyToBackend(path);
  if (result.kind === "ok") {
    const data = Array.isArray(result.data) ? result.data : [];
    return NextResponse.json(data, { status: result.status });
  }
  return NextResponse.json([], { status: 200 });
}
