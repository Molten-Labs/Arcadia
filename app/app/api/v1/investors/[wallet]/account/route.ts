import { NextResponse } from "next/server";

export function GET(
  _req: Request,
  { params }: { params: Promise<{ wallet: string }> },
) {
  return params.then(({ wallet }) => {
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
          profile: "ArcVlt1NovaXxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
          trader_handle: "nova",
          shares: 1200,
          pending_withdraw_shares: 0,
          withdraw_ready_ts: 0,
          cost_basis_usd: 6000,
          bump: 253,
        },
        {
          profile: "ArcVlt2VegaYxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
          trader_handle: "vega",
          shares: 800,
          pending_withdraw_shares: 0,
          withdraw_ready_ts: 0,
          cost_basis_usd: 6000,
          bump: 252,
        },
      ],
    });
  });
}
