"use client";

import { useState, useSyncExternalStore } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useRouter } from "next/navigation";
import type { ElementType } from "react";
import { Bell, CheckCircle, Copy, Crown, ExternalLink, Eye, EyeOff, Moon, Save, Shield, Sliders, TrendingUp } from "lucide-react";

import { useRole } from "@/lib/role-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader, PageShell } from "@/components/pages/investor/chrome";
import { Panel, PanelLabel } from "@/components/pages/investor/surfaces";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "arcadia_settings";

interface Settings {
  notifScoreMilestone: boolean;
  notifDeposit: boolean;
  notifPayout: boolean;
  notifNAV: boolean;
  displayName: string;
  bio: string;
  location: string;
  twitterHandle: string;
  showWallet: boolean;
  compactMode: boolean;
  reduceMotion: boolean;
  devnetWarnings: boolean;
}

type ProfileKey = "displayName" | "bio" | "location" | "twitterHandle";

const DEFAULTS: Settings = {
  notifScoreMilestone: true,
  notifDeposit: true,
  notifPayout: true,
  notifNAV: false,
  displayName: "Darc",
  bio: "Scalping crypto futures. 24yrs.",
  location: "Bolinao, Philippines",
  twitterHandle: "",
  showWallet: true,
  compactMode: false,
  reduceMotion: false,
  devnetWarnings: true,
};

const PROFILE_FIELDS: { key: ProfileKey; label: string; placeholder: string }[] = [
  { key: "displayName", label: "Display name", placeholder: "Your name" },
  { key: "bio", label: "Bio", placeholder: "Short description…" },
  { key: "location", label: "Location", placeholder: "City, Country" },
  { key: "twitterHandle", label: "Twitter / X handle", placeholder: "@handle" },
];

function loadSettings(): Settings {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const s = localStorage.getItem(STORAGE_KEY);
    return s ? { ...DEFAULTS, ...JSON.parse(s) } : DEFAULTS;
  } catch {
    return DEFAULTS;
  }
}

const emptySubscribe = () => () => {};

/** SSR-safe hydration flag: false on the server and first client paint, true after. */
function useHydrated(): boolean {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
}

function ToggleSwitch({
  checked,
  onChange,
  label,
  sub,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  sub?: string;
}) {
  return (
    <div className="flex items-center justify-between py-3">
      <div>
        <p className="text-xs font-semibold text-ink">{label}</p>
        {sub ? <p className="mt-0.5 text-[0.625rem] text-faint">{sub}</p> : null}
      </div>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        role="switch"
        aria-checked={checked}
        aria-label={label}
        className={cn(
          "relative h-5 w-10 shrink-0 rounded-full border motion-safe:transition-colors motion-safe:duration-200 focus-visible:ring-2 focus-visible:ring-acid focus-visible:ring-offset-2 focus-visible:ring-offset-void",
          checked ? "border-acid bg-acid" : "border-line bg-panel-2",
        )}
      >
        <span
          className="absolute top-[2px] size-4 rounded-full bg-void motion-safe:transition-all motion-safe:duration-200"
          style={{ left: checked ? "calc(100% - 18px)" : "2px", background: checked ? "var(--color-void)" : "var(--color-muted)" }}
        />
      </button>
    </div>
  );
}

function SectionCard({ title, icon: Icon, children }: { title: string; icon: ElementType; children: React.ReactNode }) {
  return (
    <Panel className="group acid-int overflow-hidden">
      <div className="flex items-center gap-2 border-b border-line bg-panel-2 px-5 py-3.5">
        <Icon className="size-3.5 text-acid transition-transform duration-300 ease-[cubic-bezier(0.19,1,0.22,1)] group-hover:scale-110 motion-reduce:transition-none motion-reduce:transform-none" />
        <PanelLabel>{title}</PanelLabel>
      </div>
      <div className="divide-y divide-line px-5">{children}</div>
    </Panel>
  );
}

export default function SettingsPage() {
  const { connected, publicKey } = useWallet();
  const { role, setRole } = useRole();
  const router = useRouter();
  const hydrated = useHydrated();
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showKey, setShowKey] = useState(false);

  // Render defaults until hydrated so the client's first paint matches the
  // server (no hydration mismatch); the persisted values swap in after mount.
  const view = hydrated ? settings : DEFAULTS;

  const update = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  };

  const save = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const copyAddress = () => {
    if (publicKey) {
      navigator.clipboard.writeText(publicKey.toBase58());
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  const switchRole = (next: "trader" | "investor") => {
    setRole(next);
    router.push(next === "trader" ? "/terminal" : "/dashboard");
  };

  const walletAddr = publicKey?.toBase58() ?? "";

  return (
    <PageShell width="narrow">
      <PageHeader
        kicker="Preferences"
        title="Settings"
        subtitle="Preferences saved to this browser"
        actions={
          <Button variant={saved ? "secondary" : "default"} onClick={save}>
            {saved ? <CheckCircle className="size-3.5 text-success" /> : <Save className="size-3.5" />}
            {saved ? "Saved!" : "Save changes"}
          </Button>
        }
      />

      <div className="space-y-4">
        {/* Wallet */}
        <SectionCard title="Wallet" icon={Shield}>
          <div className="py-3">
            <p className="mb-2 text-xs font-semibold text-ink">Connected wallet</p>
            {connected ? (
              <div className="flex items-center gap-2 rounded-lg border border-line bg-panel-2 px-3 py-2">
                <span aria-hidden className="size-2 shrink-0 rounded-full bg-success" />
                <code className="flex-1 truncate font-mono text-[0.6875rem] text-ink">
                  {showKey ? walletAddr : `${walletAddr.slice(0, 8)}…${walletAddr.slice(-8)}`}
                </code>
                <button
                  type="button"
                  onClick={() => setShowKey((v) => !v)}
                  aria-label={showKey ? "Hide full address" : "Show full address"}
                  className="text-faint hover:text-ink"
                >
                  {showKey ? <EyeOff className="size-3" /> : <Eye className="size-3" />}
                </button>
                <button
                  type="button"
                  onClick={copyAddress}
                  aria-label="Copy address"
                  className="text-faint hover:text-ink"
                >
                  {copied ? <CheckCircle className="size-3 text-success" /> : <Copy className="size-3" />}
                </button>
                <a
                  href={`https://solscan.io/account/${walletAddr}?cluster=devnet`}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="View on Solscan"
                  className="text-acid hover:text-acid/80"
                >
                  <ExternalLink className="size-3" />
                </a>
              </div>
            ) : (
              <p className="text-xs text-faint">Not connected</p>
            )}
          </div>
          <ToggleSwitch
            checked={view.showWallet}
            onChange={(v) => update("showWallet", v)}
            label="Show wallet address publicly"
            sub="Displayed on your trader profile"
          />
        </SectionCard>

        {/* Role */}
        <SectionCard title="Role" icon={TrendingUp}>
          <div className="py-3">
            <p className="mb-3 text-[0.625rem] text-faint">
              Switching role navigates you to the appropriate dashboard.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => switchRole("trader")}
                className={cn(
                  "flex flex-1 items-center justify-center gap-2 rounded-lg border py-2.5 text-xs font-bold transition-colors active:scale-[0.98] motion-reduce:transition-none motion-reduce:transform-none",
                  role === "trader"
                    ? "border-acid/40 bg-acid/10 text-acid"
                    : "border-line bg-panel-2 text-faint hover:text-ink",
                )}
              >
                <TrendingUp className="size-3.5" />
                Trader
                {role === "trader" ? (
                  <span className="rounded bg-acid/20 px-1.5 py-0.5 text-[0.5625rem] text-acid">Active</span>
                ) : null}
              </button>
              <button
                type="button"
                onClick={() => switchRole("investor")}
                className={cn(
                  "flex flex-1 items-center justify-center gap-2 rounded-lg border py-2.5 text-xs font-bold transition-colors active:scale-[0.98] motion-reduce:transition-none motion-reduce:transform-none",
                  role === "investor"
                    ? "border-tier-established/40 bg-tier-established/10 text-tier-established"
                    : "border-line bg-panel-2 text-faint hover:text-ink",
                )}
              >
                <Crown className="size-3.5" />
                Investor
                {role === "investor" ? (
                  <span className="rounded bg-tier-established/20 px-1.5 py-0.5 text-[0.5625rem] text-tier-established">
                    Active
                  </span>
                ) : null}
              </button>
            </div>
          </div>
        </SectionCard>

        {/* Profile */}
        <SectionCard title="Profile" icon={Sliders}>
          {PROFILE_FIELDS.map(({ key, label, placeholder }) => (
            <div key={key} className="py-3">
              <label htmlFor={`settings-${key}`} className="mb-1.5 block">
                <PanelLabel>{label}</PanelLabel>
              </label>
              <Input
                id={`settings-${key}`}
                type="text"
                value={view[key]}
                onChange={(e) => update(key, e.target.value)}
                placeholder={placeholder}
              />
            </div>
          ))}
        </SectionCard>

        {/* Notifications */}
        <SectionCard title="Notifications" icon={Bell}>
          <ToggleSwitch
            checked={view.notifScoreMilestone}
            onChange={(v) => update("notifScoreMilestone", v)}
            label="Score milestone alerts"
            sub="When your Arcadia Score crosses a tier boundary"
          />
          <ToggleSwitch
            checked={view.notifDeposit}
            onChange={(v) => update("notifDeposit", v)}
            label="New investor deposits"
            sub="When USDC enters your vault"
          />
          <ToggleSwitch
            checked={view.notifPayout}
            onChange={(v) => update("notifPayout", v)}
            label="Payout confirmations"
            sub="When profit share is settled to your wallet"
          />
          <ToggleSwitch
            checked={view.notifNAV}
            onChange={(v) => update("notifNAV", v)}
            label="NAV update digest"
            sub="Daily summary of vault NAV changes"
          />
        </SectionCard>

        {/* Display */}
        <SectionCard title="Display" icon={Moon}>
          <ToggleSwitch
            checked={view.compactMode}
            onChange={(v) => update("compactMode", v)}
            label="Compact mode"
            sub="Reduce spacing in tables and lists"
          />
          <ToggleSwitch
            checked={view.reduceMotion}
            onChange={(v) => update("reduceMotion", v)}
            label="Reduce motion"
            sub="Disable animated transitions"
          />
          <ToggleSwitch
            checked={view.devnetWarnings}
            onChange={(v) => update("devnetWarnings", v)}
            label="Show devnet warnings"
            sub="Label all simulated actions clearly"
          />
        </SectionCard>

        {/* Save */}
        <div className="pt-2">
          <Button variant={saved ? "secondary" : "default"} size="lg" className="w-full" onClick={save}>
            {saved ? <CheckCircle className="size-4 text-success" /> : null}
            {saved ? "All changes saved" : "Save Settings"}
          </Button>
          <p className="mt-2 text-center text-[0.625rem] text-faint">
            Settings are stored in your browser via localStorage
          </p>
        </div>
      </div>
    </PageShell>
  );
}
