"use client";

import { useRouter } from "next/navigation";
import { useRole } from "@/lib/role-context";
import { TrendingUp, Crown } from "lucide-react";

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
      className="fixed inset-0 z-[200] flex items-center justify-center overflow-auto py-8"
      style={{
        background: "rgba(0,0,0,0.97)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
      }}
    >
      {/* Ambient glows */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div
          className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vh] rounded-full blur-[160px] opacity-15"
          style={{ background: "var(--color-mint)" }}
        />
        <div
          className="absolute bottom-[-10%] right-[-10%] w-[50vw] h-[50vh] rounded-full blur-[160px] opacity-8"
          style={{ background: "var(--color-gold)" }}
        />
      </div>

      <div className="relative z-10 w-full max-w-3xl px-6 flex flex-col items-center gap-10">

        {/* Header */}
        <div className="text-center space-y-3">
          <div className="flex items-center justify-center gap-2.5 mb-2">
            <div
              className="flex items-center justify-center w-8 h-8 rounded-xl"
              style={{ background: "var(--color-mint)" }}
            >
              <span className="text-[10px] font-black tracking-wider" style={{ color: "#ffffff" }}>
                ARC
              </span>
            </div>
            <span
              className="text-xl font-black tracking-tighter"
              style={{ color: "var(--color-ink)" }}
            >
              Arcadia
            </span>
          </div>
          <h1
            className="text-4xl font-black tracking-tighter"
            style={{ color: "var(--color-ink)", letterSpacing: "-0.04em" }}
          >
            Choose Your Path
          </h1>
          <p className="text-sm font-medium" style={{ color: "var(--color-muted)" }}>
            Your role shapes your experience in the protocol
          </p>
        </div>

        {/* Role Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 w-full">

          {/* Trader */}
          <button
            onClick={() => choose("trader")}
            className="group relative rounded-2xl text-left transition-all duration-200 hover:scale-[1.02] active:scale-[0.99]"
            style={{
              background: "var(--color-panel)",
              border: "1px solid var(--color-line)",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.borderColor = "var(--color-mint)";
              (e.currentTarget as HTMLElement).style.boxShadow = "0 0 40px rgba(79,158,255,0.12)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.borderColor = "var(--color-line)";
              (e.currentTarget as HTMLElement).style.boxShadow = "none";
            }}
          >
            <div
              className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
              style={{ background: "radial-gradient(circle at 30% 30%, rgba(79,158,255,0.05) 0%, transparent 70%)" }}
            />

            <div className="relative p-8 flex flex-col gap-6">
              <div
                className="w-14 h-14 rounded-xl flex items-center justify-center"
                style={{ background: "rgba(79,158,255,0.12)", border: "1px solid rgba(79,158,255,0.25)" }}
              >
                <TrendingUp size={26} style={{ color: "var(--color-mint)" }} />
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span
                    className="text-[10px] font-black uppercase tracking-[0.15em] px-2 py-0.5 rounded-full"
                    style={{ background: "rgba(79,158,255,0.12)", color: "var(--color-mint)" }}
                  >
                    Trader
                  </span>
                </div>
                <h2
                  className="text-2xl font-black tracking-tight"
                  style={{ color: "var(--color-ink)", letterSpacing: "-0.03em" }}
                >
                  Trader
                </h2>
              </div>

              <p className="text-sm leading-relaxed" style={{ color: "var(--color-muted)" }}>
                Execute trades, build your on-chain reputation, and open your vault to investors.
                Your Arcadia Score defines your tier and profit split.
              </p>

              <ul className="space-y-2">
                {[
                  "Live trade terminal",
                  "Arcadia Score & tier tracking",
                  "Vault management & profit withdrawal",
                  "Analytics & equity curve",
                ].map((item) => (
                  <li key={item} className="flex items-center gap-2.5 text-xs" style={{ color: "var(--color-muted)" }}>
                    <span
                      className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                      style={{ background: "var(--color-mint)" }}
                    />
                    {item}
                  </li>
                ))}
              </ul>

              <div
                className="mt-2 py-3 rounded-xl text-center text-xs font-black uppercase tracking-widest transition-all duration-150"
                style={{
                  background: "var(--color-mint)",
                  color: "#ffffff",
                }}
              >
                Enter as Trader →
              </div>
            </div>
          </button>

          {/* Investor */}
          <button
            onClick={() => choose("investor")}
            className="group relative rounded-2xl text-left transition-all duration-200 hover:scale-[1.02] active:scale-[0.99]"
            style={{
              background: "var(--color-panel)",
              border: "1px solid var(--color-line)",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.borderColor = "var(--color-gold)";
              (e.currentTarget as HTMLElement).style.boxShadow = "0 0 40px rgba(240,180,41,0.10)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.borderColor = "var(--color-line)";
              (e.currentTarget as HTMLElement).style.boxShadow = "none";
            }}
          >
            <div
              className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
              style={{ background: "radial-gradient(circle at 70% 30%, rgba(240,180,41,0.05) 0%, transparent 70%)" }}
            />

            <div className="relative p-8 flex flex-col gap-6">
              <div
                className="w-14 h-14 rounded-xl flex items-center justify-center"
                style={{ background: "rgba(240,180,41,0.10)", border: "1px solid rgba(240,180,41,0.22)" }}
              >
                <Crown size={26} style={{ color: "var(--color-gold)" }} />
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span
                    className="text-[10px] font-black uppercase tracking-[0.15em] px-2 py-0.5 rounded-full"
                    style={{ background: "rgba(240,180,41,0.10)", color: "var(--color-gold)" }}
                  >
                    Investor
                  </span>
                </div>
                <h2
                  className="text-2xl font-black tracking-tight"
                  style={{ color: "var(--color-ink)", letterSpacing: "-0.03em" }}
                >
                  Investor
                </h2>
              </div>

              <p className="text-sm leading-relaxed" style={{ color: "var(--color-muted)" }}>
                Allocate capital to verified traders. Monitor NAV, returns, and positions
                across the marketplace. Capital grows with the traders you back.
              </p>

              <ul className="space-y-2">
                {[
                  "Browse & filter trader marketplace",
                  "Deposit into vaults & track NAV",
                  "Portfolio dashboard & returns",
                  "Investment history & payouts",
                ].map((item) => (
                  <li key={item} className="flex items-center gap-2.5 text-xs" style={{ color: "var(--color-muted)" }}>
                    <span
                      className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                      style={{ background: "var(--color-gold)" }}
                    />
                    {item}
                  </li>
                ))}
              </ul>

              <div
                className="mt-2 py-3 rounded-xl text-center text-xs font-black uppercase tracking-widest transition-all duration-150"
                style={{
                  background: "var(--color-gold)",
                  color: "#0a0800",
                }}
              >
                Enter as Investor →
              </div>
            </div>
          </button>
        </div>

        <p className="text-[11px] text-center" style={{ color: "var(--color-faint)" }}>
          You can switch roles anytime from Settings
        </p>
      </div>
    </div>
  );
}
