/**
 * Canonical Sign-In-With-Solana message. Shared by the client signer
 * (use-auth) and the dev verifier (lib/server/dev-auth) — and it must match
 * the Rust backend's `siws_message()` in auth.rs byte for byte.
 */
export function buildSiwsMessage(pubkey: string, nonce: string): string {
  return `Arcadia wants you to sign in with your Solana account:\n${pubkey}\n\nNonce: ${nonce}`;
}
