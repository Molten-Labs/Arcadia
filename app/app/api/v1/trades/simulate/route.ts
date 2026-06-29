/**
 * POST /api/v1/trades/simulate — proxy or mock for recording a simulated trade.
 *
 * When BACKEND_URL is set this route proxies the request to the Rust API
 * (POST /v1/trades/simulate) which does the oracle co-sign and DB write.
 *
 * Without BACKEND_URL it returns a mock success response and logs the trade
 * so the frontend can exercise the trading terminal flow in dev.
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

  // ── Proxy to Rust backend when configured ─────────────────────────
  if (BACKEND_URL) {
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
  }

  // ── Dev mock ───────────────────────────────────────────────────────
  const body = await req.json().catch(() => ({})) as {
    profile?:    string;
    market?:     string;
    direction?:  number;
    size_usd?:   number;
    leverage?:   number;
    entry_px?:   number;
    exit_px?:    number;
    opened_at?:  string;
    closed_at?:  string;
  };

  if (!body.profile || !body.market || body.direction === undefined) {
    return NextResponse.json(
      { error: "Missing required fields: profile, market, direction" },
      { status: 400 },
    );
  }

  const size_usd   = body.size_usd   ?? 1000;
  const leverage   = body.leverage   ?? 1;
  const entry_px   = body.entry_px   ?? 100;
  const exit_px    = body.exit_px    ?? entry_px * 1.01; // default +1% move
  const direction  = body.direction;

  // Compute PnL (mirrors Rust compute_pnl)
  const raw_pnl = direction === 0
    ? size_usd * (exit_px - entry_px) / entry_px          // long
    : size_usd * (entry_px - exit_px) / entry_px;         // short
  const fees_usd      = parseFloat((size_usd * leverage * 0.001).toFixed(6));
  const realized_pnl  = parseFloat((raw_pnl - fees_usd).toFixed(6));
  const was_liquidated = realized_pnl < -(size_usd * 0.8);

  const now       = new Date();
  const closed_at = body.closed_at ? new Date(body.closed_at) : now;
  const opened_at = body.opened_at
    ? new Date(body.opened_at)
    : new Date(closed_at.getTime() - 3_600_000);

  const slug = `${body.market}`.replace("/", "-").toLowerCase();
  const sig  = `sim:mock:${slug}:${closed_at.getTime()}`;

  return NextResponse.json({
    signature:      sig,
    oracle_signed:  false,
    simulated:      true,    // tells the frontend no chain tx is needed
    market:         body.market,
    direction,
    size_usd:       size_usd.toString(),
    leverage:       leverage.toString(),
    entry_px:       entry_px.toString(),
    exit_px:        exit_px.toString(),
    realized_pnl:   realized_pnl.toString(),
    fees_usd:       fees_usd.toString(),
    was_liquidated,
    opened_at:      opened_at.toISOString(),
    closed_at:      closed_at.toISOString(),
    label:          "devnet simulation (mock)",
  });
}
