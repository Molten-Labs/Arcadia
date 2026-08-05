/**
 * POST /api/v1/trades/simulate — proxy a trade record to the Rust backend.
 *
 * Proxies to POST /v1/trades/simulate on the Rust API (oracle co-sign + DB write).
 * There is no mock fallback: without BACKEND_URL this returns 503.
 *
 * Expected body (matches SimTradeReq in server-rs/crates/api/src/simulate.rs):
 *   profile    string   — vault profile address (base58)
 *   market     string   — e.g. "SOL/USD"
 *   direction  number   — 0 = long, 1 = short
 *   size_usd   number   — notional position size in USD
 *   leverage   number   — multiplier e.g. 3.0 for 3×
 *   entry_px   number   — entry price in USD
 *   exit_px?   number   — exit price (optional; server uses live price if omitted)
 *   opened_at? string   — ISO timestamp (optional)
 *   closed_at? string   — ISO timestamp (optional)
 */
import { NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL ?? "";

export async function POST(req: Request) {
  const authHeader = req.headers.get("authorization") ?? "";

  if (!BACKEND_URL) {
    return NextResponse.json(
      { error: "Backend not configured" },
      { status: 503 },
    );
  }

  // ── Proxy to Rust backend ─────────────────────────────────────────
  try {
    const body = await req.text();
    const upstream = await fetch(`${BACKEND_URL}/v1/trades/simulate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(authHeader ? { Authorization: authHeader } : {}),
      },
      body,
    });
    const data = await upstream.json();
    return NextResponse.json(data, { status: upstream.status });
  } catch {
    return NextResponse.json({ error: "Backend unreachable" }, { status: 502 });
  }
}