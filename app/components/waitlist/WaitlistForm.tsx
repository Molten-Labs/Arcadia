"use client";

import { useState, type FormEvent } from "react";import { useLoginWithEmail, usePrivy, useToken } from "@privy-io/react-auth";
import { AlertTriangle, CheckCircle, Loader2, Copy, BadgeCheck } from "lucide-react";
const ROLE_OPTIONS = ["trader", "investor", "both"] as const;
const EXP_OPTIONS = ["", "beginner", "<1", "1-3", "3+"] as const;

interface SuccessState {
  email: string;
  referral_code: string;
  position: number;
  email_verified: boolean;
  referral_count: number;
  tier: string;
  fee_discount_pct: number;
  benefits: string[];
}

interface TierInfo {
  referral_count: number;
  tier: string;
  fee_discount_pct: number;
  benefits: string[];
}

/** Next reward threshold copy for the given verified-referral count. */
function nextTierHint(count: number): string {
  if (count < 1) return "1 verified referral → Wave-1 onboarding priority";
  if (count < 3) return `${3 - count} more verified referral${3 - count === 1 ? "" : "s"} → 10% platform-fee discount`;
  if (count < 5) return `${5 - count} more verified referral${5 - count === 1 ? "" : "s"} → 20% platform-fee discount`;
  return "You're at the top tier — Arcadian III";
}

export function WaitlistForm({ source = "waitlist-page" }: { source?: string }) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("");
  const [experience, setExperience] = useState("");
  const [twitter, setTwitter] = useState("");
  const [wallet, setWallet] = useState("");

  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState<SuccessState | null>(null);

  const [refCode, setRefCode] = useState(() => {
    if (typeof window === "undefined") return "";
    const ref = new URLSearchParams(window.location.search).get("ref");
    return ref ? ref.toUpperCase() : "";
  });

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email.trim() || !role) return;
    setStatus("loading");
    setMessage("");

    try {
      const params = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
      const res = await fetch("/api/v1/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          role,
          experience,
          twitter: twitter.trim(),
          wallet: wallet.trim(),
          ref_code: refCode.trim().toUpperCase(),
          privy_token: await privyToken(),
          utm_source: params.get("utm_source") ?? "",
          utm_medium: params.get("utm_medium") ?? "",
          utm_campaign: params.get("utm_campaign") ?? "",
          utm_term: params.get("utm_term") ?? "",
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setStatus("success");
        setSuccess({
          email: data.email,
          referral_code: data.referral_code,
          position: data.position,
          email_verified: data.email_verified ?? false,
          referral_count: data.referral_count ?? 0,
          tier: data.tier ?? "None",
          fee_discount_pct: data.fee_discount_pct ?? 0,
          benefits: data.benefits ?? [],
        });
      } else {
        setStatus("error");
        setMessage(data?.error?.message ?? "Something went wrong.");
      }
    } catch {
      setStatus("error");
      setMessage("Network error. Please try again.");
    }
  }

  const privy = usePrivy();
  const { getAccessToken } = useToken();

  // Access token for the verified email, or null when not verified.
  async function privyToken(): Promise<string | null> {
    if (!privy.authenticated || !privy.user?.email?.address) return null;
    const token = await getAccessToken();
    return token ?? null;
  }

  if (status === "success" && success) {
    return (
      <SuccessView
        email={success.email}
        referralCode={success.referral_code}
        position={success.position}
        emailVerified={success.email_verified}
        referralCount={success.referral_count}
        tier={success.tier}
        feeDiscountPct={success.fee_discount_pct}
        benefits={success.benefits}
      />
    );
  }

  return (
    <form onSubmit={handleSubmit} className="w-full space-y-3.5">
      <div>
        <label htmlFor="wl-email" className="mb-1.5 block font-mono text-xs tracking-[0.12em] text-muted uppercase">Email *</label>
        <input id="wl-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="h-11 w-full rounded-xl border border-line bg-panel-2 px-4 font-mono text-sm text-ink outline-none placeholder:text-faint focus:border-acid/50 focus:ring-1 focus:ring-acid/30" />
        <EmailVerifyControl email={email.trim()} />
      </div>

      <div>
        <p className="mb-1.5 font-mono text-xs tracking-[0.12em] text-muted uppercase">I am a... *</p>
        <div className="flex gap-2">
          {ROLE_OPTIONS.map((r) => {
            const active = role === r;
            const label = r.charAt(0).toUpperCase() + r.slice(1);
            return (
              <button type="button" key={r}
                onClick={() => setRole(r)}
                className={`flex-1 h-11 rounded-xl border font-mono text-sm font-bold tracking-[0.06em] uppercase transition-all ${
                  active
                    ? "border-acid bg-acid text-void"
                    : "border-line bg-panel-2 text-faint hover:border-acid/40 hover:text-ink"
                }`}>
                {label}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <label htmlFor="wl-exp" className="mb-1.5 block font-mono text-xs tracking-[0.12em] text-muted uppercase">Experience</label>
        <select id="wl-exp" value={experience} onChange={(e) => setExperience(e.target.value)}
          className="h-11 w-full rounded-xl border border-line bg-panel-2 px-4 font-mono text-sm text-ink outline-none focus:border-acid/50 focus:ring-1 focus:ring-acid/30">
          <option value="">Select...</option>
          {EXP_OPTIONS.filter(Boolean).map((e) => (
            <option key={e} value={e}>{e === "<1" ? "<1 year" : e === "3+" ? "3+ years" : e === "1-3" ? "1-3 years" : e.charAt(0).toUpperCase() + e.slice(1)}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="wl-twitter" className="mb-1.5 block font-mono text-xs tracking-[0.12em] text-muted uppercase">X (optional)</label>
          <input id="wl-twitter" type="text" value={twitter} onChange={(e) => setTwitter(e.target.value)} placeholder="@handle"
            className="h-11 w-full rounded-xl border border-line bg-panel-2 px-4 font-mono text-sm text-ink outline-none placeholder:text-faint focus:border-acid/50 focus:ring-1 focus:ring-acid/30" />
        </div>
        <div>
          <label htmlFor="wl-wallet" className="mb-1.5 block font-mono text-xs tracking-[0.12em] text-muted uppercase">Wallet (optional)</label>
          <input id="wl-wallet" type="text" value={wallet} onChange={(e) => setWallet(e.target.value)} placeholder="Solana address"
            className="h-11 w-full rounded-xl border border-line bg-panel-2 px-4 font-mono text-sm text-ink outline-none placeholder:text-faint focus:border-acid/50 focus:ring-1 focus:ring-acid/30" />
        </div>
      </div>

      <input type="text" name="_hp" className="absolute -left-[9999px]" tabIndex={-1} autoComplete="off" aria-hidden />

      <button type="submit" disabled={status === "loading"}
        className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-acid px-6 font-mono text-sm font-bold tracking-[0.1em] text-void uppercase transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-acid focus-visible:ring-offset-2 focus-visible:ring-offset-void disabled:opacity-50">
        {status === "loading" ? <><Loader2 className="size-4 animate-spin" /> Signing up...</> : "Join waitlist"}
      </button>

      {status === "error" && message ? (
        <div className="flex items-start gap-2 rounded-lg border border-danger/25 bg-danger/10 px-3 py-2 text-sm text-danger">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          <span>{message}</span>
        </div>
      ) : null}
      <p className="text-center font-mono text-xs tracking-[0.08em] text-muted">No spam. Unsubscribe anytime.</p>
    </form>
  );
}

interface SuccessViewProps {
  email: string;
  referralCode: string;
  position: number;
  emailVerified: boolean;
  referralCount: number;
  tier: string;
  feeDiscountPct: number;
  benefits: string[];
}

function SuccessView({
  email,
  referralCode,
  position,
  emailVerified,
  referralCount,
  tier,
  feeDiscountPct,
  benefits,
}: SuccessViewProps) {
  const [copied, setCopied] = useState(false);
  const { getAccessToken } = useToken();
  const [tierInfo, setTierInfo] = useState<TierInfo>({
    referral_count: referralCount,
    tier,
    fee_discount_pct: feeDiscountPct,
    benefits,
  });
  const [activated, setActivated] = useState(emailVerified);
  const refLink = `https://arcadia.dev/waitlist?ref=${referralCode}`;

  async function handleVerified() {
    try {
      const res = await fetch("/api/v1/waitlist/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, privy_token: await getAccessToken() }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setActivated(true);
        setTierInfo({
          referral_count: data.referral_count ?? tierInfo.referral_count,
          tier: data.tier ?? tierInfo.tier,
          fee_discount_pct: data.fee_discount_pct ?? tierInfo.fee_discount_pct,
          benefits: data.benefits ?? tierInfo.benefits,
        });
      }
    } catch {
      // verification failed silently; the control shows its own error state
    }
  }

  return (
    <div className="space-y-5 text-center">
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-acid/25 bg-acid/[0.04] p-8">
        <CheckCircle className="size-10 text-acid" aria-hidden />
        <p className="text-lg font-bold text-ink">You&apos;re on the list.</p>
        <p className="font-mono text-5xl font-bold tracking-tight text-acid">
          #{position}
        </p>
        <p className="text-sm text-muted">
          <span className="font-mono text-ink">{email}</span> &mdash; you&apos;re <strong>#{position}</strong> in the queue.
        </p>
      </div>

      {!activated ? (
        <div className="rounded-2xl border border-line bg-panel p-6 text-left">
          <p className="mb-1 font-mono text-xs tracking-[0.12em] text-faint uppercase">Verify your email</p>
          <p className="mb-3 text-xs text-muted">
            Your referral link counts <strong className="text-ink">only verified</strong> signups. Verify with a one-time code
            sent to your inbox to activate it.
          </p>
          <EmailVerifyControl email={email} compact onVerified={handleVerified} />
        </div>
      ) : (
        <div className="flex items-center justify-center gap-2 rounded-2xl border border-acid/25 bg-acid/[0.04] px-6 py-3">
          <BadgeCheck className="size-4 text-acid" aria-hidden />
          <p className="font-mono text-xs tracking-[0.1em] text-ink uppercase">Email verified &mdash; referrals active</p>
        </div>
      )}

      <div className="rounded-2xl border border-line bg-panel p-6">
        <p className="mb-2 font-mono text-xs tracking-[0.12em] text-faint uppercase">Your referral code</p>
        <p className="font-mono text-2xl font-bold tracking-[0.15em] text-acid">{referralCode}</p>
        <p className="mt-2 text-xs text-muted">Share your unique link &mdash; verified signups move you up the queue.</p>
        <button
          onClick={() => { navigator.clipboard.writeText(refLink); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
          className="mt-4 inline-flex items-center gap-2 rounded-lg border border-line bg-panel-2 px-4 py-2 font-mono text-xs text-ink transition-colors hover:border-acid/40"
        >
          <Copy className="size-3.5" aria-hidden />
          {copied ? "Copied!" : "Copy referral link"}
        </button>
      </div>

      <div className="rounded-2xl border border-line bg-panel p-6 text-left">
        <div className="flex items-baseline justify-between">
          <p className="font-mono text-xs tracking-[0.12em] text-faint uppercase">Referral tier</p>
          <p className="font-mono text-sm font-bold text-acid">
            {tierInfo.referral_count} verified
          </p>
        </div>
        <p className="mt-2 font-display text-lg font-bold text-ink">{tierInfo.tier === "None" ? "No tier yet" : tierInfo.tier}</p>
        {tierInfo.fee_discount_pct > 0 ? (
          <p className="mt-1 text-xs text-muted">{tierInfo.fee_discount_pct}% platform-fee discount</p>
        ) : null}
        <ul className="mt-3 space-y-1">
          {tierInfo.benefits.map((b) => (
            <li key={b} className="flex items-center gap-2 text-xs text-muted">
              <CheckCircle className="size-3.5 shrink-0 text-acid" aria-hidden /> {b}
            </li>
          ))}
        </ul>
        <p className="mt-3 border-t border-line pt-3 font-mono text-xs text-faint">{nextTierHint(tierInfo.referral_count)}</p>
      </div>
    </div>
  );
}

/**
 * Email OTP verification via Privy (Privy sends the code and verifies it).
 * - sendCode → Privy emails a one-time code
 * - loginWithCode → Privy verifies it; on success the email is proven
 */
function EmailVerifyControl({
  email,
  compact = false,
  onVerified,
}: {
  email: string;
  compact?: boolean;
  onVerified?: () => void;
}) {
  const { sendCode, loginWithCode } = useLoginWithEmail();
  const privy = usePrivy();
  const [step, setStep] = useState<"idle" | "awaiting-code" | "verified">("idle");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Verify ownership now (OTP flow) or treat an existing matching Privy
  // session as already proven. Derived during render, not synced via effect.
  const alreadyAuthenticated =
    privy.authenticated && privy.user?.email?.address === email;

  if (step === "verified" || alreadyAuthenticated) {
    return (
      <p className="mt-2 flex items-center gap-1.5 font-mono text-xs text-acid">
        <BadgeCheck className="size-3.5" aria-hidden /> email verified
      </p>
    );
  }

  async function handleSend() {
    if (!email || !email.includes("@")) return;
    setBusy(true);
    setError("");
    try {
      await sendCode({ email });
      setStep("awaiting-code");
    } catch {
      setError("Couldn't send the code. Check the address and try again.");
    } finally {
      setBusy(false);
    }
  }

  async function handleConfirm() {
    if (!code.trim()) return;
    setBusy(true);
    setError("");
    try {
      await loginWithCode({ code: code.trim() });
      setStep("verified");
      onVerified?.();
    } catch {
      setError("That code didn't work. Try again or request a new one.");
    } finally {
      setBusy(false);
    }
  }

  if (step === "awaiting-code") {
    return (
      <div className={`mt-2 flex gap-2 ${compact ? "" : ""}`}>
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          placeholder="6-digit code"
          inputMode="numeric"
          className="h-10 w-32 rounded-lg border border-line bg-panel-2 px-3 font-mono text-sm text-ink outline-none placeholder:text-faint focus:border-acid/50"
        />
        <button
          type="button"
          onClick={handleConfirm}
          disabled={busy || code.length < 6}
          className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-acid/40 bg-acid/10 px-4 font-mono text-xs font-bold tracking-[0.08em] text-acid uppercase transition-colors hover:bg-acid/20 disabled:opacity-40"
        >
          {busy ? <Loader2 className="size-3.5 animate-spin" /> : null} Confirm
        </button>
        <button
          type="button"
          onClick={handleSend}
          disabled={busy}
          className="inline-flex h-10 items-center rounded-lg border border-line bg-panel-2 px-3 font-mono text-xs text-muted transition-colors hover:text-ink"
        >
          Resend
        </button>
        {error ? <p className="self-center text-xs text-danger">{error}</p> : null}
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={handleSend}
        disabled={busy || !email || !email.includes("@")}
        className="mt-2 inline-flex h-9 items-center gap-1.5 rounded-lg border border-line bg-panel-2 px-3 font-mono text-xs text-muted transition-colors hover:border-acid/40 hover:text-ink disabled:opacity-40"
      >
        {busy ? <Loader2 className="size-3.5 animate-spin" /> : <BadgeCheck className="size-3.5" aria-hidden />}
        Verify email with a code
      </button>
      {error ? <p className="mt-1 text-xs text-danger">{error}</p> : null}
    </>
  );
}
