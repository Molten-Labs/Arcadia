/**
 * POST /api/v1/traders/init — proxy to Rust backend, or dev mock.
 *
 * Creates a trader profile for the authenticated wallet.
 */
import { NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL ?? "";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { handle?: string };
  const token = req.headers.get("authorization");

  if (BACKEND_URL) {
    try {
      const upstream = await fetch(`${BACKEND_URL}/v1/traders/init`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: token } : {}),
        },
        body: JSON.stringify(body),
      });
      const data = await upstream.json();
      return NextResponse.json(data, { status: upstream.status });
    } catch {
      return NextResponse.json({ error: "Backend unreachable" }, { status: 502 });
    }
  }

  // Dev mock: use wallet from JWT, or generate one
  const wallet = token
    ? (() => {
        try {
          const payload = token.split(".")[1];
          const decoded = JSON.parse(atob(payload));
          return decoded.sub as string;
        } catch {
          return "dev_wallet_111111111111111111111111111111";
        }
      })()
    : "dev_wallet_111111111111111111111111111111";

  const profile = wallet;
  const handle = body.handle ?? `trader_${wallet.slice(0, 8)}`;

  return NextResponse.json({ profile, handle, role: "trader" });
}
