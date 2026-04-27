import { PublicKey } from "@solana/web3.js";

import { KILN_API_BASE_URL, SOLANA_CLUSTER, SOL_MINT, USDC_MINT } from "./constants";

export type JupiterRoute = "SolToUsdc" | "UsdcToSol";

export interface JupiterQuoteParams {
  route: JupiterRoute;
  amount: bigint;
  slippageBps: number;
}

export function isRealJupiterEnabled(): boolean {
  return SOLANA_CLUSTER === "mainnet-beta";
}

export function routeMints(route: JupiterRoute): { inputMint: PublicKey; outputMint: PublicKey } {
  return route === "SolToUsdc"
    ? { inputMint: SOL_MINT, outputMint: USDC_MINT }
    : { inputMint: USDC_MINT, outputMint: SOL_MINT };
}

async function readJsonOrThrow(response: Response) {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message =
      typeof body?.error === "string"
        ? body.error
        : typeof body?.reason === "string"
          ? body.reason
          : `Jupiter proxy failed with ${response.status}`;
    throw new Error(message);
  }
  return body;
}

export async function fetchJupiterQuote(params: JupiterQuoteParams) {
  const { inputMint, outputMint } = routeMints(params.route);
  const query = new URLSearchParams({
    cluster: SOLANA_CLUSTER,
    inputMint: inputMint.toBase58(),
    outputMint: outputMint.toBase58(),
    amount: params.amount.toString(),
    slippageBps: String(params.slippageBps),
  });
  const response = await fetch(`${KILN_API_BASE_URL}/jupiter/quote?${query.toString()}`);
  return readJsonOrThrow(response);
}

export async function fetchJupiterSwapInstructions(input: {
  userPublicKey: PublicKey;
  quoteResponse: unknown;
  destinationTokenAccount?: PublicKey;
}) {
  const response = await fetch(`${KILN_API_BASE_URL}/jupiter/swap-instructions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      cluster: SOLANA_CLUSTER,
      userPublicKey: input.userPublicKey.toBase58(),
      quoteResponse: input.quoteResponse,
      wrapAndUnwrapSol: false,
      destinationTokenAccount: input.destinationTokenAccount?.toBase58(),
    }),
  });
  return readJsonOrThrow(response);
}
