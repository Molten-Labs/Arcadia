import { NextResponse } from "next/server";
import {
  claimFaucet,
  faucetEnabled,
  parseTargetAddress,
} from "@/lib/server/faucet";

/**
 * POST /api/v1/faucet — devnet USDC faucet claim.
 *
 * Body: { address, amount? }  (amount in whole USDC, defaults to 1000)
 *
 * Transfers devnet USDC from the funded reserve wallet to the caller's
 * wallet, plus a SOL airdrop for fees. Devnet only, rate-limited per wallet.
 * Returns a real error when the reserve is unset or underfunded — never a
 * fabricated success.
 */
export async function POST(req: Request) {
  if (!faucetEnabled()) {
    return NextResponse.json(
      { error: "Faucet is not configured (FAUCET_KEYPAIR missing)." },
      { status: 503 },
    );
  }

  const body = (await req.json().catch(() => ({}))) as {
    address?: string;
    amount?: number;
  };
  if (!body.address) {
    return NextResponse.json({ error: "Missing address" }, { status: 400 });
  }
  if (!parseTargetAddress(body.address)) {
    return NextResponse.json({ error: "Invalid Solana address" }, { status: 400 });
  }

  const amount =
    typeof body.amount === "number" &&
    Number.isFinite(body.amount) &&
    body.amount > 0
      ? body.amount
      : undefined;

  const result = await claimFaucet(body.address, amount);
  if (!result.ok) {
    return NextResponse.json({ error: result.reason }, { status: 429 });
  }
  return NextResponse.json(result, { status: 200 });
}
