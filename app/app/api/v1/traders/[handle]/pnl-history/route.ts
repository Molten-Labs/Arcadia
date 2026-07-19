/**
 * GET /api/v1/traders/[handle]/pnl-history
 * Proxies to GET /v1/traders/:handle/pnl-history on the Rust backend and
 * normalises the response to the frontend's DailyPnL[] shape
 * ({ date: string; pnl: number }).
 *
 * Backend returns: [{ day: "YYYY-MM-DD", pnl_usd: number|string }]
 * Frontend expects: [{ date: "YYYY-MM-DD", pnl: number }]
 */
import { NextResponse } from "next/server";
import { proxyToBackend } from "@/lib/backend-proxy";
import type { DailyPnL } from "@/lib/types";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ handle: string }> },
) {
  const { handle } = await params;
  const url = new URL(req.url);
  const days = url.searchParams.get("days") ?? "";

  const path = days
    ? `/v1/traders/${handle}/pnl-history?days=${encodeURIComponent(days)}`
    : `/v1/traders/${handle}/pnl-history`;

  const result = await proxyToBackend(path);
  if (result.kind === "ok") {
    const raw = Array.isArray(result.data) ? result.data : [];
    const points: DailyPnL[] = raw.map((r: unknown) => {
      const o = (r ?? {}) as Record<string, unknown>;
      return {
        date: String(o.day ?? o.date ?? ""),
        pnl: Number(o.pnl_usd ?? o.pnl ?? 0),
      };
    });
    return NextResponse.json(points, { status: result.status });
  }
  return NextResponse.json([]);
}