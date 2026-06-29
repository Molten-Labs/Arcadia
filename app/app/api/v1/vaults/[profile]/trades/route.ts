import { NextResponse } from "next/server";
import { MOCK_TRADERS } from "@/lib/mock-data";

export function GET(
  _req: Request,
  { params }: { params: Promise<{ profile: string }> },
) {
  return params.then(({ profile }) => {
    const trader = MOCK_TRADERS.find((t) => t.profile === profile);
    if (!trader) {
      return NextResponse.json([], { status: 200 });
    }
    return NextResponse.json(trader.trades.slice(0, 50));
  });
}
