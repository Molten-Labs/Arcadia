/**
 * GET /api/v1/traders/[handle]/score-history
 * Proxies to GET /v1/traders/:handle/score-history on the Rust backend and
 * normalises the response to the frontend's ScorePoint[] shape
 * ({ ts: number; score: number }).
 *
 * Backend returns: [{ computed_at: ISO, score, tier, ... }]
 * Frontend expects: [{ ts: unixSeconds, score }]
 */
import { NextResponse } from "next/server";
import { proxyToBackend } from "@/lib/backend-proxy";
import type { ScorePoint } from "@/lib/types";

function toUnix(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = Number(v);
    if (!Number.isNaN(n) && v.trim() !== "") return n;
    const d = Date.parse(v);
    return Number.isNaN(d) ? 0 : Math.floor(d / 1000);
  }
  return 0;
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ handle: string }> },
) {
  const { handle } = await params;
  const url = new URL(req.url);
  const limit = url.searchParams.get("limit") ?? "";

  const path = limit
    ? `/v1/traders/${handle}/score-history?limit=${encodeURIComponent(limit)}`
    : `/v1/traders/${handle}/score-history`;

  const result = await proxyToBackend(path);
  if (result.kind === "ok") {
    const raw = Array.isArray(result.data) ? result.data : [];
    const points: ScorePoint[] = raw.map((r: unknown) => {
      const o = (r ?? {}) as Record<string, unknown>;
      return {
        ts: toUnix(o.computed_at ?? o.ts),
        score: Number(o.score ?? 0),
      };
    });
    return NextResponse.json(points, { status: result.status });
  }
  return NextResponse.json([]);
}