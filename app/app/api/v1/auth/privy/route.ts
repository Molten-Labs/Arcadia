/**
 * POST /api/v1/auth/privy — proxy to the Rust backend, or inline Privy verify.
 *
 * With BACKEND_URL set this proxies upstream (the Rust backend verifies the
 * Privy token and issues a JWT). Without BACKEND_URL the route calls Privy's
 * REST API directly to validate the token, extracts the linked Solana wallet,
 * and mints a dev-mode JWT.
 */
import { NextResponse } from "next/server";
import { mintDevToken } from "@/lib/server/dev-auth";

const BACKEND_URL = process.env.BACKEND_URL ?? "";

interface PrivyLinkedAccount {
  type: string;
  address?: string;
  chain?: string;
}

interface PrivyUser {
  id: string;
  linked_accounts: PrivyLinkedAccount[];
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { token?: string };

  if (!body.token) {
    return NextResponse.json({ error: "Missing token" }, { status: 400 });
  }

  if (BACKEND_URL) {
    try {
      const upstream = await fetch(`${BACKEND_URL}/v1/auth/privy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: body.token }),
      });
      const data = await upstream.json();
      return NextResponse.json(data, { status: upstream.status });
    } catch {
      return NextResponse.json({ error: "Auth backend unreachable" }, { status: 502 });
    }
  }

  // Dev mode: verify the Privy token via Privy's REST API
  try {
    const privyRes = await fetch("https://api.privy.io/v1/users/me", {
      headers: { Authorization: `Bearer ${body.token}` },
    });

    if (!privyRes.ok) {
      return NextResponse.json({ error: "Privy token invalid" }, { status: 401 });
    }

    const user = (await privyRes.json()) as PrivyUser;

    const solanaWallet = user.linked_accounts.find(
      (a) => a.type === "solana_wallet" || a.chain === "solana",
    );

    if (!solanaWallet?.address) {
      return NextResponse.json(
        { error: "No Solana wallet linked to this Privy account" },
        { status: 400 },
      );
    }

    const { token } = mintDevToken(solanaWallet.address);
    return NextResponse.json({ jwt: token });
  } catch {
    return NextResponse.json({ error: "Privy verification failed" }, { status: 502 });
  }
}
