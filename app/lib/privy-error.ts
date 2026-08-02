"use client";

/**
 * Maps a Privy login/connect failure to a user-actionable diagnostic. Privy's
 * modal shows only a generic "Could not log in with wallet"; this surfaces the
 * real error code so a silent config failure (e.g. an origin that isn't
 * allowlisted on the dashboard) is recognizable instead of invisible.
 */
export function describePrivyError(error: unknown): string {
  const code = extractPrivyErrorCode(error);
  const normalized = code ?? "unknown_error";
  return describePrivyCode(normalized);
}

function describePrivyCode(code: string): string {
  switch (code) {
    case "user_exited_auth_flow":
    case "user_exited_connect_wallet_flow":
    case "exited_auth_flow":
    case "exited_connect_wallet_flow":
      return "Login cancelled.";
    case "invalid_origin":
      return "Origin not allowed in the Privy dashboard (Allowed Origins).";
    case "unknown_auth_error":
    case "unknown_connect_wallet_error":
    case "unknown_error":
      return "Unknown Privy error. Check the console for the request sent to auth.privy.io.";
    case "invalid_data":
      return "Stale wallet session. Disconnect and reconnect the wallet, then try again.";
    default:
      return `Privy ${code}.`;
  }
}

export function extractPrivyErrorCode(
  error: unknown,
): string | undefined {
  if (typeof error === "string" && error.length > 0) {
    return error;
  }
  if (
    typeof error === "object" &&
    error !== null &&
    "privyErrorCode" in error &&
    typeof (error as { privyErrorCode?: unknown }).privyErrorCode === "string"
  ) {
    return (error as { privyErrorCode?: string }).privyErrorCode;
  }
  if (error instanceof Error) {
    const m = error.message.match(/"error"\s*:\s*"([A-Za-z0-9_-]+)"/);
    if (m) return m[1];
  }
  return undefined;
}