"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { usePrivy } from "@privy-io/react-auth";
import { useWalletCompat } from "@/lib/use-wallet-compat";
import { ArrowRight, Check, Loader2, Wallet, X } from "lucide-react";
import { cn } from "@/lib/utils";

type OnboardingStep = "role" | "wallet" | "profile" | "done";
type Role = "trader" | "investor" | "both" | null;

const ROLE_KEY = "arcadia_role";
const ONBOARDING_KEY = "arcadia_onboarding_completed";

export default function OnboardingPage() {
  const router = useRouter();
  const privy = usePrivy();
  const { connected, publicKey } = useWalletCompat();

  const [step, setStep] = useState<OnboardingStep>("role");
  const [role, setRole] = useState<Role>(null);
  const [xHandle, setXHandle] = useState("");
  const [discord, setDiscord] = useState("");
  const [referral, setReferral] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Already completed onboarding? redirect.
  useEffect(() => {
    const done = localStorage.getItem(ONBOARDING_KEY);
    if (done === "true") {
      router.replace("/terminal");
    }
  }, [router]);

  // Step 2: auto-skip if wallet already connected.
  useEffect(() => {
    if (step === "wallet" && connected && publicKey) {
      setStep("profile");
    }
  }, [step, connected, publicKey]);

  const handleRoleSelect = useCallback((r: Role) => {
    setRole(r);
    setStep("wallet");
  }, []);

  const handleFinish = useCallback(async () => {
    setSubmitting(true);
    try {
      // Save role
      if (role === "trader" || role === "investor") {
        localStorage.setItem(ROLE_KEY, role);
      }

      const token = localStorage.getItem("arcadia_jwt");

      // Initialize trader profile in the backend
      if ((role === "trader" || role === "both") && token) {
        await fetch("/api/v1/traders/init", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            handle: xHandle || undefined,
          }),
        }).catch(() => {});
      }

      localStorage.setItem(ONBOARDING_KEY, "true");
      setStep("done");
      setTimeout(() => router.replace("/terminal"), 1200);
    } finally {
      setSubmitting(false);
    }
  }, [role, xHandle, discord, referral, router]);

  const roleOptions: { value: Role; label: string; desc: string }[] = [
    { value: "trader", label: "I'm a Trader", desc: "Build reputation, open a vault, get funded" },
    { value: "investor", label: "I'm an Investor", desc: "Discover traders, allocate capital, track returns" },
    { value: "both", label: "Both", desc: "Trade and invest through Arcadia" },
  ];

  if (!privy.ready) {
    return (
      <div className="flex h-dvh items-center justify-center bg-void">
        <Loader2 className="size-6 text-acid motion-safe:animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col bg-void">
      {/* Top bar */}
      <div className="flex items-center justify-between border-b border-line px-4 py-3 sm:px-6">
        <span className="font-display text-sm font-bold text-ink uppercase tracking-wider">Arcadia</span>
        {step !== "done" && (
          <span className="font-mono text-[10px] text-faint">
            Step {["role", "wallet", "profile"].indexOf(step) + 1}/3
          </span>
        )}
      </div>

      <div className="flex flex-1 items-center justify-center p-4">
        <div className="w-full max-w-sm">
          {/* ── Step 1: Role ─────────────────────────────────────────── */}
          {step === "role" && (
            <div className="motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-4 motion-safe:duration-300">
              <h1 className="mb-1 text-2xl font-black text-ink">Welcome to Arcadia</h1>
              <p className="mb-6 text-sm text-muted">Choose how you want to use the platform.</p>
              <div className="flex flex-col gap-2.5">
                {roleOptions.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => handleRoleSelect(opt.value)}
                    className="group flex w-full items-center justify-between rounded-xl border border-line bg-panel p-4 text-left transition-all hover:border-acid/30 hover:bg-acid/[0.03] active:scale-[0.99]"
                  >
                    <div>
                      <p className="text-sm font-bold text-ink group-hover:text-acid transition-colors">{opt.label}</p>
                      <p className="mt-0.5 text-xs text-muted">{opt.desc}</p>
                    </div>
                    <ArrowRight className="size-4 shrink-0 text-faint group-hover:text-acid transition-colors" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── Step 2: Wallet (skip if already connected) ──────────── */}
          {step === "wallet" && !connected && (
            <div className="motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-4 motion-safe:duration-300">
              <h1 className="mb-1 text-2xl font-black text-ink">Connect a Wallet</h1>
              <p className="mb-6 text-sm text-muted">
                Link a Solana wallet to use Arcadia. You can also do this later.
              </p>
              <button
                type="button"
                onClick={() => privy.connectWallet()}
                className="flex w-full items-center justify-center gap-2.5 rounded-xl bg-acid py-3.5 text-sm font-bold text-void transition-all hover:bg-acid/90 active:scale-[0.98]"
              >
                <Wallet className="size-4" />
                Connect Solana Wallet
              </button>
              <button
                type="button"
                onClick={() => setStep("profile")}
                className="mt-3 w-full rounded-xl border border-line py-3 text-sm text-muted transition-colors hover:text-ink"
              >
                Skip for now
              </button>
            </div>
          )}

          {/* Step 2 already has wallet — brief confirmation then auto-advance */}
          {step === "wallet" && connected && publicKey && (
            <div className="text-center motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-300">
              <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full border border-acid/30 bg-acid/10">
                <Check className="size-6 text-acid" />
              </div>
              <p className="text-sm font-bold text-ink">Wallet connected</p>
              <p className="mt-1 font-mono text-xs text-muted">
                {publicKey.toBase58().slice(0, 4)}…{publicKey.toBase58().slice(-4)}
              </p>
            </div>
          )}

          {/* ── Step 3: Optional profile info ───────────────────────── */}
          {step === "profile" && (
            <div className="motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-4 motion-safe:duration-300">
              <h1 className="mb-1 text-2xl font-black text-ink">Almost done</h1>
              <p className="mb-6 text-sm text-muted">Add optional profile info (you can do this later).</p>

              <div className="space-y-3.5">
                <div>
                  <label className="mb-1.5 block font-mono text-[10px] font-bold tracking-widest text-faint uppercase">
                    X (Twitter) username
                  </label>
                  <div className="relative">
                    <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-xs text-faint">@</span>
                    <input
                      type="text"
                      value={xHandle}
                      onChange={(e) => setXHandle(e.target.value)}
                      placeholder="username"
                      className="w-full rounded-lg border border-line bg-panel py-2.5 pr-3 pl-7 text-sm text-ink outline-none transition-colors focus-visible:border-acid/60 focus-visible:ring-2 focus-visible:ring-acid/30"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block font-mono text-[10px] font-bold tracking-widest text-faint uppercase">
                    Discord
                  </label>
                  <input
                    type="text"
                    value={discord}
                    onChange={(e) => setDiscord(e.target.value)}
                    placeholder="username#0000"
                    className="w-full rounded-lg border border-line bg-panel py-2.5 px-3 text-sm text-ink outline-none transition-colors focus-visible:border-acid/60 focus-visible:ring-2 focus-visible:ring-acid/30"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block font-mono text-[10px] font-bold tracking-widest text-faint uppercase">
                    Referral code
                  </label>
                  <input
                    type="text"
                    value={referral}
                    onChange={(e) => setReferral(e.target.value)}
                    placeholder="Enter code"
                    className="w-full rounded-lg border border-line bg-panel py-2.5 px-3 text-sm text-ink outline-none transition-colors focus-visible:border-acid/60 focus-visible:ring-2 focus-visible:ring-acid/30"
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={handleFinish}
                disabled={submitting}
                className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-acid py-3.5 text-sm font-bold text-void transition-all hover:bg-acid/90 active:scale-[0.98] disabled:opacity-50"
              >
                {submitting ? (
                  <Loader2 className="size-4 motion-safe:animate-spin" />
                ) : (
                  <Check className="size-4" />
                )}
                {submitting ? "Saving…" : "Finish Setup"}
              </button>
            </div>
          )}

          {/* ── Done ────────────────────────────────────────────────── */}
          {step === "done" && (
            <div className="text-center motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-300">
              <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full border border-success/30 bg-success/10">
                <Check className="size-7 text-success" />
              </div>
              <h1 className="text-xl font-black text-ink">You're all set!</h1>
              <p className="mt-1 text-sm text-muted">Redirecting to the dashboard…</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
