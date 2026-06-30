"use client";

import { useRouter } from "next/navigation";
import { useRole } from "@/lib/role-context";

export function RoleGate() {
  const { showRoleGate, setRole } = useRole();
  const router = useRouter();

  if (!showRoleGate) return null;

  function choose(r: "trader" | "investor") {
    setRole(r);
    router.push(r === "trader" ? "/terminal" : "/dashboard");
  }

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 200,
        background: "#000",
        display: "flex", flexDirection: "column",
      }}
    >
      {/* Top bar */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "1.25rem 2rem",
        borderBottom: "1px solid #181818",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 26, height: 26, borderRadius: 7,
            background: "var(--color-mint)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 7, fontWeight: 900, color: "#fff", letterSpacing: "0.05em" }}>ARC</span>
          </div>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.8125rem", fontWeight: 700, color: "var(--color-ink)", letterSpacing: "-0.02em" }}>
            Arcadia
          </span>
        </div>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.22em", textTransform: "uppercase", color: "#333" }}>
          New session
        </span>
      </div>

      {/* Role prompt */}
      <div style={{
        padding: "3rem 2rem 1.5rem",
        display: "flex", flexDirection: "column", alignItems: "flex-start",
        maxWidth: 800,
      }}>
        <p style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.25em", textTransform: "uppercase", color: "#444", marginBottom: "0.875rem" }}>
          How are you using Arcadia?
        </p>
        <h1 style={{
          fontFamily: "var(--font-sans)", fontWeight: 800,
          fontSize: "clamp(1.75rem, 4vw, 2.5rem)",
          color: "var(--color-ink)", letterSpacing: "-0.045em",
          lineHeight: 1.1, margin: 0,
        }}>
          Select your role to continue.
        </h1>
      </div>

      {/* Two-panel split */}
      <div style={{
        flex: 1, display: "grid", gridTemplateColumns: "1fr 1fr",
        borderTop: "1px solid #181818",
        overflow: "hidden",
      }}>

        {/* Trader */}
        <button
          onClick={() => choose("trader")}
          style={{
            display: "flex", flexDirection: "column", justifyContent: "space-between",
            padding: "2.5rem 2.5rem",
            background: "transparent", border: "none",
            borderRight: "1px solid #181818",
            cursor: "pointer", textAlign: "left",
            transition: "background 0.15s",
            position: "relative",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "#080808"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
        >
          {/* Top */}
          <div>
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "3px 10px", borderRadius: 4,
              background: "rgba(79,158,255,0.08)",
              border: "1px solid rgba(79,158,255,0.18)",
              marginBottom: "2rem",
            }}>
              <span style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--color-mint)", display: "block" }} />
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 8, fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--color-mint)" }}>
                Trader
              </span>
            </div>

            <h2 style={{
              fontFamily: "var(--font-sans)", fontWeight: 800,
              fontSize: "clamp(2rem, 4vw, 3.5rem)", letterSpacing: "-0.05em",
              color: "var(--color-ink)", margin: "0 0 1.25rem", lineHeight: 1,
            }}>
              I trade.
            </h2>

            <p style={{ fontSize: "0.9375rem", color: "#555", lineHeight: 1.6, maxWidth: "36ch", margin: 0 }}>
              Build an on-chain reputation, open a vault to investors, and earn a profit split based on your Arcadia Score.
            </p>
          </div>

          {/* Bottom */}
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            paddingTop: "2rem",
            borderTop: "1px solid #181818",
            marginTop: "3rem",
          }}>
            <div>
              <p style={{ fontFamily: "var(--font-mono)", fontSize: 8, letterSpacing: "0.2em", textTransform: "uppercase", color: "#333", marginBottom: 4 }}>
                Access
              </p>
              <p style={{ fontFamily: "var(--font-mono)", fontSize: "0.6875rem", color: "#555" }}>
                Terminal · Analytics · Payouts · Vault
              </p>
            </div>
            <div style={{
              display: "flex", alignItems: "center", gap: 8,
              fontFamily: "var(--font-mono)", fontSize: "0.75rem", fontWeight: 700,
              color: "var(--color-mint)", letterSpacing: "0.02em",
            }}>
              Continue <span style={{ fontSize: "1rem", lineHeight: 1 }}>→</span>
            </div>
          </div>
        </button>

        {/* Investor */}
        <button
          onClick={() => choose("investor")}
          style={{
            display: "flex", flexDirection: "column", justifyContent: "space-between",
            padding: "2.5rem 2.5rem",
            background: "transparent", border: "none",
            cursor: "pointer", textAlign: "left",
            transition: "background 0.15s",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "#080808"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
        >
          {/* Top */}
          <div>
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "3px 10px", borderRadius: 4,
              background: "rgba(240,180,41,0.07)",
              border: "1px solid rgba(240,180,41,0.18)",
              marginBottom: "2rem",
            }}>
              <span style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--color-gold)", display: "block" }} />
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 8, fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--color-gold)" }}>
                Investor
              </span>
            </div>

            <h2 style={{
              fontFamily: "var(--font-sans)", fontWeight: 800,
              fontSize: "clamp(2rem, 4vw, 3.5rem)", letterSpacing: "-0.05em",
              color: "var(--color-ink)", margin: "0 0 1.25rem", lineHeight: 1,
            }}>
              I allocate.
            </h2>

            <p style={{ fontSize: "0.9375rem", color: "#555", lineHeight: 1.6, maxWidth: "36ch", margin: 0 }}>
              Browse verified traders, deposit into vaults, and monitor your portfolio NAV and returns across the marketplace.
            </p>
          </div>

          {/* Bottom */}
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            paddingTop: "2rem",
            borderTop: "1px solid #181818",
            marginTop: "3rem",
          }}>
            <div>
              <p style={{ fontFamily: "var(--font-mono)", fontSize: 8, letterSpacing: "0.2em", textTransform: "uppercase", color: "#333", marginBottom: 4 }}>
                Access
              </p>
              <p style={{ fontFamily: "var(--font-mono)", fontSize: "0.6875rem", color: "#555" }}>
                Marketplace · Portfolio · Returns · History
              </p>
            </div>
            <div style={{
              display: "flex", alignItems: "center", gap: 8,
              fontFamily: "var(--font-mono)", fontSize: "0.75rem", fontWeight: 700,
              color: "var(--color-gold)", letterSpacing: "0.02em",
            }}>
              Continue <span style={{ fontSize: "1rem", lineHeight: 1 }}>→</span>
            </div>
          </div>
        </button>
      </div>

      {/* Footer */}
      <div style={{
        padding: "0.875rem 2rem",
        borderTop: "1px solid #181818",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "#2a2a2a", letterSpacing: "0.1em" }}>
          Role can be changed anytime from Settings
        </span>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "#2a2a2a" }}>
          Solana Devnet
        </span>
      </div>
    </div>
  );
}
