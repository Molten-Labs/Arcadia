import { NextResponse } from "next/server";

export function GET(
  _req: Request,
  { params }: { params: Promise<{ wallet: string }> },
) {
  return params.then(() => {
    return NextResponse.json([
      {
        profile: "ArcVlt1NovaXxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
        trader_handle: "nova",
        shares: 1200,
        value_usd: 7080,
        cost_basis_usd: 6000,
        pnl_usd: 1080,
        roi_pct: 18.0,
      },
      {
        profile: "ArcVlt2VegaYxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
        trader_handle: "vega",
        shares: 800,
        value_usd: 6460,
        cost_basis_usd: 6000,
        pnl_usd: 460,
        roi_pct: 7.67,
      },
    ]);
  });
}
