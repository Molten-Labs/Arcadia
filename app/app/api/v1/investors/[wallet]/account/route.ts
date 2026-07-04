import { NextResponse } from "next/server";
import { proxyToBackend } from "@/lib/backend-proxy";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ wallet: string }> },
) {
  const { wallet } = await params;
  const authHeader = req.headers.get("authorization");
  const result = await proxyToBackend(`/v1/investors/${wallet}/account`, {
    authHeader,
  });
  if (result) return NextResponse.json(result.data, { status: result.status });

  const now = Math.floor(Date.now() / 1000);
  return NextResponse.json({
    main: {
      wallet,
      account_pubkey: `InvAcc${wallet.slice(0, 6)}xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`,
      bump: 254,
      created_at: now - 86400 * 45,
    },
    positions: [
      {
        profile: "ArcVlt1NovaXKJH3fZpJGJPmoLdWCqJrNnUjPrDDzEa",
        trader_handle: "nova",
        shares: 1200,
        pending_withdraw_shares: 0,
        withdraw_ready_ts: 0,
        cost_basis_usd: 6000,
        bump: 253,
      },
      {
        profile: "ArcVlt2VegaYKJH3fZpJGJPmoLdWCqJrNnUjPrDDzEb",
        trader_handle: "vega",
        shares: 800,
        pending_withdraw_shares: 0,
        withdraw_ready_ts: 0,
        cost_basis_usd: 6000,
        bump: 252,
      },
    ],
  });
}
