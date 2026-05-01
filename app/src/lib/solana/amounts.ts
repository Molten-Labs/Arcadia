export const LAMPORTS_PER_SOL_BIGINT = 1_000_000_000n;
export const USDC_DECIMALS_BIGINT = 1_000_000n;

export function parseSolToLamports(value: string): bigint | null {
  const trimmed = value.trim();
  if (!/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(trimmed)) return null;

  const [wholeRaw, fractionalRaw = ""] = trimmed.split(".");
  const wholeLamports = BigInt(wholeRaw || "0") * LAMPORTS_PER_SOL_BIGINT;
  const fractionalLamports = BigInt(fractionalRaw.padEnd(9, "0").slice(0, 9) || "0");

  return wholeLamports + fractionalLamports;
}

export function parseUsdcToUnits(value: string): bigint | null {
  const trimmed = value.trim();
  if (!/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(trimmed)) return null;

  const [wholeRaw, fractionalRaw = ""] = trimmed.split(".");
  const wholeUnits = BigInt(wholeRaw || "0") * USDC_DECIMALS_BIGINT;
  const fractionalUnits = BigInt(fractionalRaw.padEnd(6, "0").slice(0, 6) || "0");

  return wholeUnits + fractionalUnits;
}
