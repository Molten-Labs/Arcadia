"use client";

import { useState, useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useRole } from "@/lib/role-context";
import { useRouter } from "next/navigation";
import {
  CheckCircle, Bell, Sliders, Moon, Shield, Save,
  TrendingUp, Crown, ExternalLink, Copy, Eye, EyeOff,
} from "lucide-react";

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

function loadSettings(): Settings {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const s = localStorage.getItem(STORAGE_KEY);
    return s ? { ...DEFAULTS, ...JSON.parse(s) } : DEFAULTS;
  } catch {
    return DEFAULTS;
  }
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
        <p className="text-xs font-semibold" style={{ color: "var(--color-ink)" }}>{label}</p>
        {sub && <p className="text-[10px] mt-0.5" style={{ color: "var(--color-faint)" }}>{sub}</p>}
      </div>
      <button
        onClick={() => onChange(!checked)}
        className="relative w-10 h-5 rounded-full flex-shrink-0 transition-colors duration-200"
        style={{
          background: checked ? "var(--color-mint)" : "var(--color-panel-2)",
          border: `1px solid ${checked ? "var(--color-mint)" : "var(--color-line)"}`,
        }}
        role="switch"
        aria-checked={checked}
      >
        <span
          className="absolute top-[2px] w-4 h-4 rounded-full bg-white transition-all duration-200 shadow-sm"
          style={{ left: checked ? "calc(100% - 18px)" : "2px" }}
        />
      </button>
    </div>
  );
}

function SectionCard({ title, icon: Icon, children }: { title: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="rounded-xl overflow-hidden" style={{ background: "var(--color-panel)", border: "1px solid var(--color-line)" }}>
      <div className="flex items-center gap-2 px-5 py-3.5" style={{ borderBottom: "1px solid var(--color-line)", background: "var(--color-panel-2)" }}>
        <Icon size={13} style={{ color: "var(--color-mint)" }} />
        <p className="text-xs font-bold uppercase tracking-widest" style={{ color: "var(--color-ink)" }}>{title}</p>
      </div>
      <div className="px-5 divide-y" style={{ borderColor: "var(--color-line)" }}>
        {children}
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const { connected, publicKey } = useWallet();
  const { role, setRole } = useRole();
  const router = useRouter();
  const [settings, setSettings] = useState<Settings>(DEFAULTS);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showKey, setShowKey] = useState(false);

  useEffect(() => {
    setSettings(loadSettings());
  }, []);

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
    <div className="min-h-screen" style={{ background: "var(--color-bg)" }}>
      <div className="max-w-2xl mx-auto px-5 py-8">
        <div className="flex items-center justify-between mb-7">
          <div>
            <h1 className="text-xl font-bold" style={{ color: "var(--color-ink)" }}>Settings</h1>
            <p className="text-xs mt-0.5" style={{ color: "var(--color-faint)" }}>
              Preferences saved to this browser
            </p>
          </div>
          <button
            onClick={save}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all"
            style={{
              background: saved ? "rgba(34,197,94,0.12)" : "var(--color-accent)",
              color: saved ? "var(--color-green)" : "var(--color-bg)",
              border: `1px solid ${saved ? "rgba(34,197,94,0.3)" : "transparent"}`,
            }}
          >
            {saved ? <CheckCircle size={13} /> : <Save size={13} />}
            {saved ? "Saved!" : "Save changes"}
          </button>
        </div>

        <div className="space-y-4">
          {/* Wallet */}
          <SectionCard title="Wallet" icon={Shield}>
            <div className="py-3">
              <p className="text-xs font-semibold mb-2" style={{ color: "var(--color-ink)" }}>Connected wallet</p>
              {connected ? (
                <div
                  className="flex items-center gap-2 rounded-lg px-3 py-2"
                  style={{ background: "var(--color-panel-2)", border: "1px solid var(--color-line)" }}
                >
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: "var(--color-green)" }} />
                  <code
                    className="text-[11px] font-mono flex-1 truncate"
                    style={{ color: "var(--color-ink)" }}
                  >
                    {showKey ? walletAddr : `${walletAddr.slice(0, 8)}…${walletAddr.slice(-8)}`}
                  </code>
                  <button onClick={() => setShowKey((v) => !v)} title={showKey ? "Hide" : "Show full"}>
                    {showKey
                      ? <EyeOff size={12} style={{ color: "var(--color-faint)" }} />
                      : <Eye size={12} style={{ color: "var(--color-faint)" }} />
                    }
                  </button>
                  <button onClick={copyAddress} title="Copy address">
                    {copied
                      ? <CheckCircle size={12} style={{ color: "var(--color-green)" }} />
                      : <Copy size={12} style={{ color: "var(--color-faint)" }} />
                    }
                  </button>
                  <a
                    href={`https://solscan.io/account/${walletAddr}?cluster=devnet`}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="View on Solscan"
                  >
                    <ExternalLink size={12} style={{ color: "var(--color-mint)" }} />
                  </a>
                </div>
              ) : (
                <p className="text-xs" style={{ color: "var(--color-faint)" }}>Not connected</p>
              )}
            </div>
            <ToggleSwitch
              checked={settings.showWallet}
              onChange={(v) => update("showWallet", v)}
              label="Show wallet address publicly"
              sub="Displayed on your trader profile"
            />
          </SectionCard>

          {/* Role */}
          <SectionCard title="Role" icon={TrendingUp}>
            <div className="py-3">
              <p className="text-[10px] mb-3" style={{ color: "var(--color-faint)" }}>
                Switching role navigates you to the appropriate dashboard.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => switchRole("trader")}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-bold transition-all"
                  style={{
                    background: role === "trader" ? "rgba(79,158,255,0.1)" : "var(--color-panel-2)",
                    border: `1px solid ${role === "trader" ? "rgba(79,158,255,0.4)" : "var(--color-line)"}`,
                    color: role === "trader" ? "var(--color-mint)" : "var(--color-faint)",
                  }}
                >
                  <TrendingUp size={13} />
                  Trader
                  {role === "trader" && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ background: "rgba(79,158,255,0.2)", color: "var(--color-mint)" }}>Active</span>
                  )}
                </button>
                <button
                  onClick={() => switchRole("investor")}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-bold transition-all"
                  style={{
                    background: role === "investor" ? "rgba(168,85,247,0.1)" : "var(--color-panel-2)",
                    border: `1px solid ${role === "investor" ? "rgba(168,85,247,0.4)" : "var(--color-line)"}`,
                    color: role === "investor" ? "#a855f7" : "var(--color-faint)",
                  }}
                >
                  <Crown size={13} />
                  Investor
                  {role === "investor" && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ background: "rgba(168,85,247,0.2)", color: "#a855f7" }}>Active</span>
                  )}
                </button>
              </div>
            </div>
          </SectionCard>

          {/* Profile */}
          <SectionCard title="Profile" icon={Sliders}>
            {[
              { key: "displayName", label: "Display name", placeholder: "Your name" },
              { key: "bio", label: "Bio", placeholder: "Short description…" },
              { key: "location", label: "Location", placeholder: "City, Country" },
              { key: "twitterHandle", label: "Twitter / X handle", placeholder: "@handle" },
            ].map(({ key, label, placeholder }) => (
              <div key={key} className="py-3">
                <label className="text-[10px] font-bold uppercase tracking-widest mb-1.5 block" style={{ color: "var(--color-faint)" }}>
                  {label}
                </label>
                <input
                  type="text"
                  value={(settings as Record<string, string>)[key] ?? ""}
                  onChange={(e) => update(key as keyof Settings, e.target.value as never)}
                  placeholder={placeholder}
                  className="w-full rounded-lg px-3 py-2 text-sm outline-none transition-all"
                  style={{
                    background: "var(--color-panel-2)",
                    border: "1px solid var(--color-line)",
                    color: "var(--color-ink)",
                  }}
                  onFocus={(e) => { e.target.style.borderColor = "var(--color-mint)"; }}
                  onBlur={(e) => { e.target.style.borderColor = "var(--color-line)"; }}
                />
              </div>
            ))}
          </SectionCard>

          {/* Notifications */}
          <SectionCard title="Notifications" icon={Bell}>
            <ToggleSwitch
              checked={settings.notifScoreMilestone}
              onChange={(v) => update("notifScoreMilestone", v)}
              label="Score milestone alerts"
              sub="When your Arcadia Score crosses a tier boundary"
            />
            <ToggleSwitch
              checked={settings.notifDeposit}
              onChange={(v) => update("notifDeposit", v)}
              label="New investor deposits"
              sub="When USDC enters your vault"
            />
            <ToggleSwitch
              checked={settings.notifPayout}
              onChange={(v) => update("notifPayout", v)}
              label="Payout confirmations"
              sub="When profit share is settled to your wallet"
            />
            <ToggleSwitch
              checked={settings.notifNAV}
              onChange={(v) => update("notifNAV", v)}
              label="NAV update digest"
              sub="Daily summary of vault NAV changes"
            />
          </SectionCard>

          {/* Display */}
          <SectionCard title="Display" icon={Moon}>
            <ToggleSwitch
              checked={settings.compactMode}
              onChange={(v) => update("compactMode", v)}
              label="Compact mode"
              sub="Reduce spacing in tables and lists"
            />
            <ToggleSwitch
              checked={settings.reduceMotion}
              onChange={(v) => update("reduceMotion", v)}
              label="Reduce motion"
              sub="Disable animated transitions"
            />
            <ToggleSwitch
              checked={settings.devnetWarnings}
              onChange={(v) => update("devnetWarnings", v)}
              label="Show devnet warnings"
              sub="Label all simulated actions clearly"
            />
          </SectionCard>

          {/* Save */}
          <div className="pt-2">
            <button
              onClick={save}
              className="w-full py-3 rounded-xl text-sm font-bold transition-all"
              style={{
                background: saved ? "rgba(34,197,94,0.12)" : "var(--color-accent)",
                color: saved ? "var(--color-green)" : "var(--color-bg)",
                border: `1px solid ${saved ? "rgba(34,197,94,0.3)" : "transparent"}`,
              }}
            >
              {saved ? "✓ All changes saved" : "Save Settings"}
            </button>
            <p className="text-[10px] text-center mt-2" style={{ color: "var(--color-faint)" }}>
              Settings are stored in your browser via localStorage
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
