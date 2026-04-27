import { z } from "zod";

import { JUPITER_API_KEY, JUPITER_SWAP_BASE_URL, SOL_MINT, USDC_MINT } from "./config.js";

const clusterSchema = z.enum(["mainnet-beta", "devnet"]);
const quoteQuerySchema = z.object({
  cluster: clusterSchema.default("devnet"),
  inputMint: z.string().min(32),
  outputMint: z.string().min(32),
  amount: z.coerce.bigint().positive(),
  slippageBps: z.coerce.number().int().min(1).max(500).default(50),
});

const swapInstructionsSchema = z.object({
  cluster: clusterSchema.default("devnet"),
  userPublicKey: z.string().min(32),
  quoteResponse: z.unknown(),
  wrapAndUnwrapSol: z.boolean().default(false),
  destinationTokenAccount: z.string().min(32).optional(),
});

function isSupportedRoute(inputMint: string, outputMint: string): boolean {
  return (
    (inputMint === SOL_MINT && outputMint === USDC_MINT) ||
    (inputMint === USDC_MINT && outputMint === SOL_MINT)
  );
}

function requireMainnetRoute(cluster: string, inputMint: string, outputMint: string) {
  if (cluster !== "mainnet-beta") {
    return {
      allowed: false,
      status: 409,
      body: {
        mode: "mock",
        reason: "Real Jupiter swaps are mainnet-beta only; devnet swaps remain guard-only.",
      },
    };
  }
  if (!isSupportedRoute(inputMint, outputMint)) {
    return {
      allowed: false,
      status: 400,
      body: { error: "Only SOL/USDC exact-in routes are supported in this release." },
    };
  }
  if (!JUPITER_API_KEY) {
    return {
      allowed: false,
      status: 503,
      body: { error: "JUPITER_API_KEY is not configured on the server." },
    };
  }
  return { allowed: true as const };
}

async function jupiterFetch(path: string, init?: RequestInit) {
  const response = await fetch(`${JUPITER_SWAP_BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "x-api-key": JUPITER_API_KEY,
      ...(init?.headers ?? {}),
    },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    return { ok: false as const, status: response.status, body };
  }
  return { ok: true as const, status: response.status, body };
}

export async function getJupiterQuote(query: unknown) {
  const parsed = quoteQuerySchema.parse(query);
  const gate = requireMainnetRoute(parsed.cluster, parsed.inputMint, parsed.outputMint);
  if (!gate.allowed) return gate;

  const params = new URLSearchParams({
    inputMint: parsed.inputMint,
    outputMint: parsed.outputMint,
    amount: parsed.amount.toString(),
    slippageBps: String(parsed.slippageBps),
    swapMode: "ExactIn",
    onlyDirectRoutes: "false",
  });
  const result = await jupiterFetch(`/quote?${params.toString()}`);
  return {
    allowed: result.ok,
    status: result.status,
    body: result.body,
  };
}

export async function getJupiterSwapInstructions(payload: unknown) {
  const parsed = swapInstructionsSchema.parse(payload);
  const quote = parsed.quoteResponse as { inputMint?: string; outputMint?: string };
  const gate = requireMainnetRoute(
    parsed.cluster,
    String(quote.inputMint ?? ""),
    String(quote.outputMint ?? ""),
  );
  if (!gate.allowed) return gate;

  const result = await jupiterFetch("/swap-instructions", {
    method: "POST",
    body: JSON.stringify({
      userPublicKey: parsed.userPublicKey,
      quoteResponse: parsed.quoteResponse,
      wrapAndUnwrapSol: parsed.wrapAndUnwrapSol,
      destinationTokenAccount: parsed.destinationTokenAccount,
    }),
  });

  return {
    allowed: result.ok,
    status: result.status,
    body: result.body,
  };
}
