"use client";

import { useState, type FormEvent } from "react";
import { CheckCircle, Loader2, Copy } from "lucide-react";

const ROLE_OPTIONS = ["", "trader", "investor", "both"] as const;
const EXP_OPTIONS = ["", "beginner", "<1", "1-3", "3+"] as const;

interface SuccessState {
  email: string;
  referral_code: string;
  dev_token: string;
}

export function WaitlistForm({ source = "waitlist-page" }: { source?: string }) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [experience, setExperience] = useState("");
  const [twitter, setTwitter] = useState("");
  const [discord, setDiscord] = useState("");
  const [wallet, setWallet] = useState("");
  const [refCode, setRefCode] = useState("");

  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState<SuccessState | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setStatus("loading");
    setMessage("");

    try {
      const params = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
      const res = await fetch("/api/v1/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          name: name.trim(),
          role,
          experience,
          twitter: twitter.trim(),
          discord: discord.trim(),
          wallet: wallet.trim(),
          ref_code: refCode.trim().toUpperCase(),
          utm_source: params.get("utm_source") ?? "",
          utm_medium: params.get("utm_medium") ?? "",
          utm_campaign: params.get("utm_campaign") ?? "",
          utm_term: params.get("utm_term") ?? "",
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setStatus("success");
        setSuccess({ email: data.email, referral_code: data.referral_code, dev_token: data.dev_token });
        setMessage("Check your email to verify your address.");
      } else {
        setStatus("error");
        setMessage(data?.error?.message ?? "Something went wrong.");
      }
    } catch {
      setStatus("error");
      setMessage("Network error. Please try again.");
    }
  }

  if (status === "success" && success) {
    return <SuccessView email={success.email} referralCode={success.referral_code} />;
  }

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-md space-y-4">
      {/* Email */}
      <div>
        <label htmlFor="wl-email" className="mb-1.5 block font-mono text-xs tracking-[0.12em] text-faint uppercase">Email *</label>
        <input id="wl-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="h-12 w-full rounded-xl border border-line bg-panel-2 px-4 font-mono text-sm text-ink outline-none placeholder:text-faint focus:border-acid/50 focus:ring-1 focus:ring-acid/30" />
      </div>

      {/* Name */}
      <div>
        <label htmlFor="wl-name" className="mb-1.5 block font-mono text-xs tracking-[0.12em] text-faint uppercase">Name</label>
        <input id="wl-name" type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Optional"
          className="h-12 w-full rounded-xl border border-line bg-panel-2 px-4 font-mono text-sm text-ink outline-none placeholder:text-faint focus:border-acid/50 focus:ring-1 focus:ring-acid/30" />
      </div>

      {/* Role + Experience grid */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="wl-role" className="mb-1.5 block font-mono text-xs tracking-[0.12em] text-faint uppercase">Role</label>
          <select id="wl-role" value={role} onChange={(e) => setRole(e.target.value)}
            className="h-12 w-full rounded-xl border border-line bg-panel-2 px-4 font-mono text-sm text-ink outline-none focus:border-acid/50 focus:ring-1 focus:ring-acid/30">
            <option value="">Select...</option>
            {ROLE_OPTIONS.filter(Boolean).map((r) => (
              <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="wl-exp" className="mb-1.5 block font-mono text-xs tracking-[0.12em] text-faint uppercase">Experience</label>
          <select id="wl-exp" value={experience} onChange={(e) => setExperience(e.target.value)}
            className="h-12 w-full rounded-xl border border-line bg-panel-2 px-4 font-mono text-sm text-ink outline-none focus:border-acid/50 focus:ring-1 focus:ring-acid/30">
            <option value="">Select...</option>
            {EXP_OPTIONS.filter(Boolean).map((e) => (
              <option key={e} value={e}>{e === "<1" ? "<1 year" : e === "3+" ? "3+ years" : e === "1-3" ? "1-3 years" : e.charAt(0).toUpperCase() + e.slice(1)}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Twitter + Discord */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="wl-twitter" className="mb-1.5 block font-mono text-xs tracking-[0.12em] text-faint uppercase">X (Twitter)</label>
          <input id="wl-twitter" type="text" value={twitter} onChange={(e) => setTwitter(e.target.value)} placeholder="@handle"
            className="h-12 w-full rounded-xl border border-line bg-panel-2 px-4 font-mono text-sm text-ink outline-none placeholder:text-faint focus:border-acid/50 focus:ring-1 focus:ring-acid/30" />
        </div>
        <div>
          <label htmlFor="wl-discord" className="mb-1.5 block font-mono text-xs tracking-[0.12em] text-faint uppercase">Discord</label>
          <input id="wl-discord" type="text" value={discord} onChange={(e) => setDiscord(e.target.value)} placeholder="user#0000"
            className="h-12 w-full rounded-xl border border-line bg-panel-2 px-4 font-mono text-sm text-ink outline-none placeholder:text-faint focus:border-acid/50 focus:ring-1 focus:ring-acid/30" />
        </div>
      </div>

      {/* Wallet */}
      <div>
        <label htmlFor="wl-wallet" className="mb-1.5 block font-mono text-xs tracking-[0.12em] text-faint uppercase">Wallet address</label>
        <input id="wl-wallet" type="text" value={wallet} onChange={(e) => setWallet(e.target.value)} placeholder="Solana wallet (optional)"
          className="h-12 w-full rounded-xl border border-line bg-panel-2 px-4 font-mono text-sm text-ink outline-none placeholder:text-faint focus:border-acid/50 focus:ring-1 focus:ring-acid/30" />
      </div>

      {/* Referral code */}
      <div>
        <label htmlFor="wl-ref" className="mb-1.5 block font-mono text-xs tracking-[0.12em] text-faint uppercase">Referral code</label>
        <input id="wl-ref" type="text" value={refCode} onChange={(e) => setRefCode(e.target.value)} placeholder="ABC123 (optional)"
          className="h-12 w-full rounded-xl border border-line bg-panel-2 px-4 font-mono text-sm text-ink outline-none placeholder:text-faint focus:border-acid/50 focus:ring-1 focus:ring-acid/30" />
      </div>

      <input type="text" name="_hp" className="absolute -left-[9999px]" tabIndex={-1} autoComplete="off" aria-hidden />

      <button type="submit" disabled={status === "loading"}
        className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-acid px-6 font-mono text-sm font-bold tracking-[0.1em] text-void uppercase transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-acid focus-visible:ring-offset-2 focus-visible:ring-offset-void disabled:opacity-50">
        {status === "loading" ? <><Loader2 className="size-4 animate-spin" /> Signing up...</> : "Join waitlist"}
      </button>

      {status === "error" && message ? <p className="text-center text-sm text-danger">{message}</p> : null}
      <p className="text-center font-mono text-[0.65rem] tracking-[0.08em] text-faint">No spam. Unsubscribe anytime.</p>
    </form>
  );
}

function SuccessView({ email, referralCode }: { email: string; referralCode: string }) {
  const [copied, setCopied] = useState(false);
  const refLink = `https://arcadia.dev/waitlist?ref=${referralCode}`;

  return (
    <div className="space-y-6 text-center">
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-acid/25 bg-acid/[0.04] p-8">
        <CheckCircle className="size-10 text-acid" aria-hidden />
        <p className="text-lg font-bold text-ink">You&apos;re on the list.</p>
        <p className="max-w-sm text-sm text-muted">
          We sent a verification email to <span className="font-mono text-ink">{email}</span>.
          Click the link to confirm your spot.
        </p>
      </div>

      <div className="rounded-2xl border border-line bg-panel p-6">
        <p className="mb-2 font-mono text-xs tracking-[0.12em] text-faint uppercase">Your referral code</p>
        <p className="font-display text-3xl font-extrabold tracking-wider text-acid">{referralCode}</p>
        <p className="mt-2 text-xs text-muted">Share your code — friends who join and verify move you up the queue.</p>

        <button
          onClick={() => { navigator.clipboard.writeText(refLink); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
          className="mt-4 inline-flex items-center gap-2 rounded-lg border border-line bg-panel-2 px-4 py-2 font-mono text-xs text-ink transition-colors hover:border-acid/40"
        >
          <Copy className="size-3.5" aria-hidden />
          {copied ? "Copied!" : "Copy referral link"}
        </button>
      </div>
    </div>
  );
}
