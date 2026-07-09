"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";

import { useRole } from "@/lib/role-context";
import { cn } from "@/lib/utils";

type RoleId = "trader" | "investor";

interface RoleOption {
  id: RoleId;
  label: string;
  headline: string;
  body: string;
  access: string;
  route: string;
  dotClass: string;
  hueClass: string;
  badgeClass: string;
}

const ROLES: RoleOption[] = [
  {
    id: "trader",
    label: "Trader",
    headline: "I trade.",
    body: "Build an on-chain reputation, open a vault to investors, and earn a profit split based on your Arcadia Score.",
    access: "Terminal / Analytics / Payouts / Vault",
    route: "/terminal",
    dotClass: "bg-acid",
    hueClass: "text-acid",
    badgeClass: "border-acid/25 bg-acid/[0.06]",
  },
  {
    id: "investor",
    label: "Investor",
    headline: "I allocate.",
    body: "Browse verified traders, deposit into vaults, and monitor your portfolio NAV and returns across the marketplace.",
    access: "Marketplace / Portfolio / Returns / History",
    route: "/dashboard",
    dotClass: "bg-cyan",
    hueClass: "text-cyan",
    badgeClass: "border-cyan/25 bg-cyan/[0.06]",
  },
];

export function RoleGate() {
  const { showRoleGate, setRole, dismissRoleGate } = useRole();
  const router = useRouter();
  const firstOptionRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!showRoleGate) return;
    firstOptionRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") dismissRoleGate();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [showRoleGate, dismissRoleGate]);

  if (!showRoleGate) return null;

  function choose(role: RoleOption) {
    setRole(role.id);
    router.push(role.route);
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Select your Arcadia role"
      className="fixed inset-0 z-[200] flex flex-col bg-void"
    >
      {/* Top bar */}
      <div className="flex items-center justify-between border-b border-line px-6 py-5 sm:px-8">
        <div className="flex items-center gap-2.5">
          <div className="flex size-[26px] items-center justify-center rounded-[7px] bg-acid">
            <span className="font-mono text-[7px] font-bold tracking-[0.05em] text-void">ARC</span>
          </div>
          <span className="font-mono text-[0.8125rem] font-bold tracking-tight text-ink">Arcadia</span>
        </div>
        <span className="font-mono text-[9px] tracking-[0.22em] text-faint uppercase">
          New session
        </span>
      </div>

      {/* Role prompt */}
      <div className="flex max-w-3xl flex-col items-start px-6 pt-12 pb-6 sm:px-8">
        <p className="mb-3.5 font-mono text-[9px] tracking-[0.25em] text-faint uppercase">
          How are you using Arcadia?
        </p>
        <h1 className="m-0 font-display text-[clamp(1.75rem,4vw,2.5rem)] font-bold leading-[1.1] tracking-[-0.03em] text-ink">
          Select your role to continue.
        </h1>
      </div>

      {/* Two-panel split */}
      <div className="grid flex-1 grid-cols-1 overflow-hidden border-t border-line md:grid-cols-2">
        {ROLES.map((role, i) => (
          <button
            key={role.id}
            ref={i === 0 ? firstOptionRef : undefined}
            type="button"
            onClick={() => choose(role)}
            className={cn(
              "group relative flex flex-col justify-between p-8 text-left outline-none transition-colors sm:p-10",
              "hover:bg-onyx hover:ring-1 hover:ring-acid/40 hover:ring-inset",
              "focus-visible:bg-onyx focus-visible:ring-2 focus-visible:ring-acid focus-visible:ring-inset",
              i === 0 && "border-b border-line md:border-r md:border-b-0",
            )}
          >
            {/* Top */}
            <div>
              <span
                className={cn(
                  "mb-8 inline-flex items-center gap-2 rounded border px-2.5 py-[3px]",
                  role.badgeClass,
                )}
              >
                <span className={cn("size-[5px] rounded-full", role.dotClass)} />
                <span className={cn("font-mono text-[8px] font-bold tracking-[0.2em] uppercase", role.hueClass)}>
                  {role.label}
                </span>
              </span>

              <h2 className="m-0 mb-5 font-display text-[clamp(2rem,4vw,3.5rem)] font-bold leading-none tracking-[-0.04em] text-ink">
                {role.headline}
              </h2>

              <p className="m-0 max-w-[36ch] text-[0.9375rem] leading-relaxed text-muted">
                {role.body}
              </p>
            </div>

            {/* Bottom */}
            <div className="mt-12 flex items-center justify-between border-t border-line pt-8">
              <div>
                <p className="mb-1 font-mono text-[8px] tracking-[0.2em] text-faint uppercase">Access</p>
                <p className="font-mono text-[0.6875rem] text-muted">{role.access}</p>
              </div>
              <div
                className={cn(
                  "flex items-center gap-2 font-mono text-xs font-bold tracking-[0.02em]",
                  role.hueClass,
                )}
              >
                Continue
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between border-t border-line px-6 py-3.5 sm:px-8">
        <span className="font-mono text-[9px] tracking-[0.1em] text-faint">
          Role can be changed anytime from Settings
        </span>
        <span className="font-mono text-[9px] tracking-[0.1em] text-faint">Solana Devnet</span>
      </div>
    </div>
  );
}
