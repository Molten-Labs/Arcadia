import { NextResponse } from "next/server";
import { getTraderByHandle } from "@/lib/mock-data";

export function GET(
  _req: Request,
  { params }: { params: Promise<{ handle: string }> },
) {
  return params.then(({ handle }) => {
    const trader = getTraderByHandle(handle);
    if (!trader) {
      return NextResponse.json({ error: "Trader not found" }, { status: 404 });
    }
    return NextResponse.json(trader);
  });
}
