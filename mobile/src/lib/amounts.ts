export const USDC_DECIMALS = 6;
export const USDC_BASE_UNITS = 1_000_000n;

export function parseUsdcToUnits(value: string): bigint | null {
  const trimmed = value.trim();
  if (!/^\d+(\.\d{0,6})?$/.test(trimmed)) return null;

  const [whole, frac = ''] = trimmed.split('.');
  const wholeUnits = BigInt(whole || '0') * USDC_BASE_UNITS;
  const fracUnits = BigInt((frac + '0'.repeat(USDC_DECIMALS)).slice(0, USDC_DECIMALS));
  return wholeUnits + fracUnits;
}

export function usdcUnitsToNumber(units: bigint): number {
  return Number(units) / Number(USDC_BASE_UNITS);
}

export function isPositiveUsdc(value: string): boolean {
  const parsed = parseUsdcToUnits(value);
  return parsed !== null && parsed > 0n;
}
