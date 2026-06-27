"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { LineChart, Line, ResponsiveContainer } from "recharts";
import {
  Twitter, MessageCircle, Send, Edit, Eye,
  MapPin, Calendar, MoreHorizontal, ChevronRight,
  CheckCircle, Loader2,
} from "lucide-react";

const DEMO = {
  name: "Darc",
  handle: "@darc.eth",
  verified: true,
  location: "Bolinao, Philippines",
  joined: "Joined Nov 2025",
  bio: "Scalping crypto futures. 24yrs. Soda-fuelled.",
  rank: "#147",
  badges: [
    { label: "First Funded", color: "#22c55e", bg: "rgba(34,197,94,0.12)", border: "rgba(34,197,94,0.25)" },
    { label: "Top 500",      color: "#60a5fa", bg: "rgba(96,165,250,0.12)", border: "rgba(96,165,250,0.25)" },
    { label: "7-Day Green",  color: "#34d399", bg: "rgba(52,211,153,0.12)", border: "rgba(52,211,153,0.25)" },
    { label: "Verified",     color: "#a855f7", bg: "rgba(168,85,247,0.12)", border: "rgba(168,85,247,0.25)" },
  ],
};

const MARKET_COINS = [
  { name: "LINK",   icon: "🔗", price: "$98,381.44",  change: "+2.41%", sparkData: [90,95,92,98,96,100,98] },
  { name: "TRON",   icon: "🔴", price: "$3,214.53",   change: "+2.41%", sparkData: [85,88,86,92,90,94,92] },
  { name: "HYPE",   icon: "⚡", price: "$2,381.89",   change: "-2.41%", sparkData: [95,92,88,85,82,80,78] },
  { name: "Stellar",icon: "⭐", price: "$843.24",     change: "-2.41%", sparkData: [90,87,84,80,77,74,72] },
  { name: "Mint",   icon: "🟢", price: "$12,042.61",  change: "-2.41%", sparkData: [92,90,87,84,80,77,75] },
];

const ACCOUNTS = [
  {
    id: "#2",
    type: "Crypto",
    funded: "Funded",
    risk: "High Risk",
    size: "$100k",
    daily_dd: 36,
    max_dd: 21,
  },
  {
    id: "#1",
    type: "Crypto",
    funded: "Eval",
    risk: "Medium Risk",
    size: "$50k",
    daily_dd: 36,
    max_dd: 61,
    profit_target: "1.6k/2k",
  },
];

const LIFETIME = [
  { label: "Trading Days",        value: "325",       color: "var(--color-ink)" },
  { label: "Win Rate",            value: "58%",        color: "var(--color-ink)" },
  { label: "Avg Profit / Day",    value: "+$264",      color: "var(--color-green)" },
  { label: "Avg. Hold Time",      value: "3h 42m",     color: "var(--color-ink)" },
  { label: "Trading Volume",      value: "$1.48m",     color: "var(--color-ink)" },
  { label: "Total PnL",           value: "+$12,418",   color: "var(--color-green)" },
  { label: "Total Payouts",       value: "$3,200",     color: "var(--color-ink)" },
  { label: "Total ROI",           value: "+12.42%",    color: "var(--color-green)" },
];

function Sparkline7({ data, positive }: { data: number[]; positive: boolean }) {
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const W = 60, H = 24;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * (W - 4) + 2;
    const y = H - 4 - ((v - min) / range) * (H - 8) + 2;
    return `${x},${y}`;
  }).join(" ");
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
      <polyline
        points={pts}
        fill="none"
        stroke={positive ? "var(--color-green)" : "var(--color-red)"}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function DDBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex gap-px">
        {Array.from({ length: 10 }, (_, i) => (
          <div
            key={i}
            className="w-2 h-2.5 rounded-sm"
            style={{
              background: i < Math.round(pct / 10) ? color : "var(--color-line)",
            }}
          />
        ))}
      </div>
      <span className="text-[10px] tnum font-semibold" style={{ color }}>
        {pct}%
      </span>
    </div>
  );
}

export default function ProfilePage() {
  const { connected, publicKey } = useWallet();

  return (
    <div className="min-h-full" style={{ background: "var(--color-bg)" }}>
      <div className="px-8 py-6">
        <h1 className="text-xl font-bold mb-0.5" style={{ color: "var(--color-ink)" }}>Profile</h1>
        <p className="text-xs mb-5" style={{ color: "var(--color-faint)" }}>
          Manage your account, payouts, security, and preferences
        </p>

        <div className="flex gap-4">
          {/* Main column */}
          <div className="flex-1 min-w-0">

            {/* Profile header card */}
            <div className="rounded card overflow-hidden mb-4">
              {/* Banner */}
              <div
                className="h-20 relative"
                style={{
                  background: "linear-gradient(135deg, #1a0a40 0%, #2d1a6e 40%, #1e0650 70%, #0e0e13 100%)",
                }}
              >
                <div
                  className="absolute top-3 right-3 text-[10px] font-bold px-2 py-1 rounded"
                  style={{ background: "rgba(14,14,19,0.6)", color: "var(--color-muted)", border: "1px solid var(--color-line)" }}
                >
                  Rank <span style={{ color: "var(--color-ink)" }}>{DEMO.rank}</span>
                </div>
              </div>

              <div className="px-5 pb-4">
                {/* Avatar row */}
                <div className="flex items-end justify-between -mt-7 mb-3">
                  <div
                    className="w-14 h-14 rounded-full border-[3px] flex items-center justify-center text-lg font-black"
                    style={{ borderColor: "var(--color-panel)", background: "var(--color-purple)", color: "#fff" }}
                  >
                    D
                  </div>
                  <div className="flex items-center gap-2 pb-1">
                    <button className="btn-ghost text-xs py-1 h-7">
                      <Eye size={12} /> View Public Profile
                    </button>
                    <button className="btn-ghost text-xs py-1 h-7">
                      <Edit size={12} /> Edit
                    </button>
                    <button className="btn-ghost text-xs py-1 h-7 px-2">
                      <MoreHorizontal size={13} />
                    </button>
                  </div>
                </div>

                {/* Name */}
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="text-base font-bold" style={{ color: "var(--color-ink)" }}>{DEMO.name}</p>
                  {DEMO.verified && (
                    <CheckCircle size={14} style={{ color: "var(--color-purple-bright)" }} />
                  )}
                  <span className="text-sm" style={{ color: "var(--color-faint)" }}>{DEMO.handle}</span>
                </div>

                <div className="flex items-center gap-4 mb-2">
                  <div className="flex items-center gap-1">
                    <MapPin size={11} style={{ color: "var(--color-faint)" }} />
                    <span className="text-[11px]" style={{ color: "var(--color-faint)" }}>{DEMO.location}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Calendar size={11} style={{ color: "var(--color-faint)" }} />
                    <span className="text-[11px]" style={{ color: "var(--color-faint)" }}>{DEMO.joined}</span>
                  </div>
                </div>
                <p className="text-sm mb-3" style={{ color: "var(--color-muted)" }}>{DEMO.bio}</p>

                <div className="flex items-center justify-between">
                  {/* Badges */}
                  <div className="flex gap-1.5 flex-wrap">
                    {DEMO.badges.map((b) => (
                      <span
                        key={b.label}
                        className="text-[10px] px-2 py-0.5 rounded font-semibold"
                        style={{ background: b.bg, color: b.color, border: `1px solid ${b.border}` }}
                      >
                        {b.label}
                      </span>
                    ))}
                  </div>
                  {/* Social */}
                  <div className="flex gap-2">
                    {[Twitter, MessageCircle, Send].map((Icon, i) => (
                      <button
                        key={i}
                        className="w-7 h-7 rounded flex items-center justify-center hover:bg-[var(--color-panel-2)] transition-colors"
                        style={{ border: "1px solid var(--color-line)" }}
                      >
                        <Icon size={13} style={{ color: "var(--color-faint)" }} />
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Get Started */}
            <div className="rounded card overflow-hidden mb-4">
              <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid var(--color-line)" }}>
                <p className="text-xs font-semibold" style={{ color: "var(--color-ink)" }}>Get Started</p>
                <button>
                  <ChevronRight size={13} style={{ color: "var(--color-faint)", transform: "rotate(90deg)" }} />
                </button>
              </div>
              <div className="divide-y" style={{ borderColor: "var(--color-line)" }}>
                {[
                  { done: true,  icon: CheckCircle, label: "Setup up your profile",     sub: "Complete your account to unlock trading", action: null,              actionLabel: "" },
                  { done: false, icon: Loader2,     label: "Start your assessment",      sub: "Purchase an evolution account to prove your edge", action: "assessment", actionLabel: "Start assessment →" },
                  { done: false, icon: Loader2,     label: "Get funded",                  sub: "Pass evaluation and trade with up to $200k of firm capital", action: "funded", actionLabel: "View funded account →" },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="flex items-center gap-3 px-4 py-3"
                    style={{ opacity: item.done ? 0.6 : 1 }}
                  >
                    <item.icon
                      size={15}
                      style={{ color: item.done ? "var(--color-green)" : "var(--color-faint)", flexShrink: 0 }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold" style={{ color: item.done ? "var(--color-faint)" : "var(--color-ink)", textDecoration: item.done ? "line-through" : "none" }}>
                        {item.label}
                      </p>
                      <p className="text-[10px]" style={{ color: "var(--color-faint)" }}>{item.sub}</p>
                    </div>
                    {!item.done && item.actionLabel && (
                      <button className="text-[10px] font-semibold flex-shrink-0" style={{ color: "var(--color-purple-bright)" }}>
                        {item.actionLabel}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Active Accounts */}
            <div className="rounded card overflow-hidden mb-4">
              <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid var(--color-line)" }}>
                <p className="text-xs font-semibold" style={{ color: "var(--color-ink)" }}>Active Accounts</p>
                <div className="flex gap-2">
                  <span className="text-[10px] px-2 py-0.5 rounded font-medium" style={{ background: "rgba(34,197,94,0.1)", color: "var(--color-green)", border: "1px solid rgba(34,197,94,0.2)" }}>
                    Active 2
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded font-medium" style={{ background: "var(--color-panel-2)", color: "var(--color-faint)", border: "1px solid var(--color-line)" }}>
                    Inactive 1
                  </span>
                  <button className="btn-ghost text-[10px] px-2 py-0.5 h-6">+ New Assessment</button>
                </div>
              </div>
              {ACCOUNTS.map((acc) => (
                <div
                  key={acc.id}
                  className="flex items-center gap-4 px-4 py-3 hover:bg-[var(--color-panel-2)] transition-colors"
                  style={{ borderBottom: "1px solid var(--color-line)" }}
                >
                  <div>
                    <p className="text-xs font-bold" style={{ color: "var(--color-ink)" }}>Account {acc.id}</p>
                    <div className="flex gap-1.5 mt-0.5">
                      <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ background: "var(--color-purple-dim)", color: "var(--color-purple-bright)", border: "1px solid rgba(124,58,237,0.2)" }}>
                        {acc.funded}
                      </span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ background: "var(--color-panel-2)", color: "var(--color-faint)", border: "1px solid var(--color-line)" }}>
                        {acc.risk}
                      </span>
                    </div>
                  </div>
                  <div>
                    <p className="text-[10px] font-medium" style={{ color: "var(--color-ink)" }}>{acc.type}</p>
                    <p className="text-[10px]" style={{ color: "var(--color-faint)" }}>{acc.size} Size</p>
                  </div>
                  {acc.profit_target && (
                    <div>
                      <p className="text-[10px] font-medium" style={{ color: "var(--color-faint)" }}>Profit Target</p>
                      <p className="text-[10px] tnum" style={{ color: "var(--color-ink)" }}>{acc.profit_target}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-[10px] font-medium mb-1" style={{ color: "var(--color-faint)" }}>Daily DD</p>
                    <DDBar pct={acc.daily_dd} color="var(--color-purple-bright)" />
                  </div>
                  <div>
                    <p className="text-[10px] font-medium mb-1" style={{ color: "var(--color-faint)" }}>Max DD</p>
                    <DDBar pct={acc.max_dd} color="var(--color-red)" />
                  </div>
                  <ChevronRight size={13} style={{ color: "var(--color-faint)", marginLeft: "auto" }} />
                </div>
              ))}
            </div>

            {/* Lifetime Stats */}
            <div className="rounded card p-4">
              <div className="flex items-center justify-between mb-4">
                <p className="text-xs font-semibold" style={{ color: "var(--color-ink)" }}>Lifetime Stats</p>
                <div className="flex gap-1">
                  {["Eval ▾","1D","7D","30D","ALL"].map((p) => (
                    <button
                      key={p}
                      className="text-[10px] px-2 py-0.5 rounded font-medium"
                      style={{ background: p === "ALL" ? "var(--color-panel-2)" : "transparent", color: "var(--color-faint)", border: p === "ALL" ? "1px solid var(--color-line)" : "none" }}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-4 gap-4">
                {LIFETIME.map(({ label, value, color }) => (
                  <div key={label}>
                    <p className="text-[10px] mb-0.5" style={{ color: "var(--color-faint)" }}>{label}</p>
                    <p className="text-base font-bold tnum" style={{ color }}>{value}</p>
                  </div>
                ))}
              </div>

              <div className="mt-4 pt-4" style={{ borderTop: "1px solid var(--color-line)" }}>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-semibold" style={{ color: "var(--color-ink)" }}>Cumulative PnL</p>
                  <div className="flex gap-1">
                    {["Eval ▾","1D","7D","30D","ALL"].map((p) => (
                      <button key={p} className="text-[10px] px-2 py-0.5 rounded font-medium" style={{ color: "var(--color-faint)" }}>{p}</button>
                    ))}
                  </div>
                </div>
                <p className="text-2xl font-black tnum mb-3" style={{ color: "var(--color-green)" }}>+$12,418</p>
                <div className="h-24">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={Array.from({ length: 20 }, (_, i) => ({ v: 10000 + i * 400 + Math.random() * 300 - 100 }))}>
                      <Line type="monotone" dataKey="v" stroke="var(--color-green)" strokeWidth={1.5} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>

          {/* Right column */}
          <div className="w-52 flex-shrink-0 flex flex-col gap-3">
            {/* Markets */}
            <div className="rounded card overflow-hidden">
              <div className="flex items-center justify-between px-3 py-2.5" style={{ borderBottom: "1px solid var(--color-line)" }}>
                <p className="text-xs font-semibold" style={{ color: "var(--color-ink)" }}>Markets</p>
                <ChevronRight size={12} style={{ color: "var(--color-faint)" }} />
              </div>
              <div className="flex gap-0 px-3 py-2 overflow-x-auto" style={{ borderBottom: "1px solid var(--color-line)" }}>
                {["Fav","Hot","Crypto","Stocks","Commodities"].map((t, i) => (
                  <button
                    key={t}
                    className="text-[10px] px-2 py-1 whitespace-nowrap font-medium"
                    style={{
                      color: i === 2 ? "var(--color-ink)" : "var(--color-faint)",
                      borderBottom: i === 2 ? "2px solid var(--color-purple-bright)" : "2px solid transparent",
                    }}
                  >
                    {t}
                  </button>
                ))}
              </div>
              <div className="px-3 py-1" style={{ borderBottom: "1px solid var(--color-line)" }}>
                <div className="grid" style={{ gridTemplateColumns: "1fr 1fr 1fr 1fr" }}>
                  {["Coin","","Price","24hr change"].map((h) => (
                    <p key={h} className="text-[9px] font-medium py-1.5" style={{ color: "var(--color-faint)" }}>{h}</p>
                  ))}
                </div>
              </div>
              {MARKET_COINS.map((coin) => {
                const pos = !coin.change.startsWith("-");
                return (
                  <div
                    key={coin.name}
                    className="px-3 py-2 hover:bg-[var(--color-panel-2)] transition-colors"
                    style={{ borderBottom: "1px solid var(--color-line)" }}
                  >
                    <div className="grid items-center" style={{ gridTemplateColumns: "1fr 1fr 1fr 1fr" }}>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[13px]">{coin.icon}</span>
                        <span className="text-[10px] font-medium" style={{ color: "var(--color-ink)" }}>{coin.name}</span>
                      </div>
                      <div>
                        <Sparkline7 data={coin.sparkData} positive={pos} />
                      </div>
                      <span className="text-[10px] tnum font-medium" style={{ color: "var(--color-ink)" }}>
                        {coin.price}
                      </span>
                      <span className="text-[10px] tnum font-semibold" style={{ color: pos ? "var(--color-green)" : "var(--color-red)" }}>
                        {coin.change}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Leaderboard widget */}
            <div className="rounded card p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold" style={{ color: "var(--color-ink)" }}>Leaderboard</p>
                <ChevronRight size={12} style={{ color: "var(--color-faint)" }} />
              </div>
              <p className="text-3xl font-black tnum" style={{ color: "var(--color-ink)" }}>{DEMO.rank}</p>
              <p className="text-[10px] mt-1" style={{ color: "var(--color-faint)" }}>
                +12 this month · Top 5.8% of funded traders
              </p>
            </div>

            {/* Announcements */}
            <div className="rounded card overflow-hidden">
              <div className="flex items-center justify-between px-3 py-2.5" style={{ borderBottom: "1px solid var(--color-line)" }}>
                <p className="text-xs font-semibold" style={{ color: "var(--color-ink)" }}>Announcements</p>
                <div className="flex gap-1">
                  <button className="w-5 h-5 rounded flex items-center justify-center hover:bg-[var(--color-panel-2)]">
                    <ChevronRight size={11} style={{ color: "var(--color-faint)", transform: "rotate(180deg)" }} />
                  </button>
                  <button className="w-5 h-5 rounded flex items-center justify-center hover:bg-[var(--color-panel-2)]">
                    <ChevronRight size={11} style={{ color: "var(--color-faint)" }} />
                  </button>
                </div>
              </div>
              {[
                { date: "14 Apr 2026", text: "Payout cycles now weekly for all funded traders", bold: false },
                { date: "09 Apr 2026", text: "New assets class live: Commodities", bold: false },
                { date: "07 Apr 2026", text: "Maintenance window: Sunday 20 Apr 02:00 UTC", bold: true },
              ].map((a) => (
                <div key={a.date} className="px-3 py-2.5 hover:bg-[var(--color-panel-2)] transition-colors" style={{ borderBottom: "1px solid var(--color-line)" }}>
                  <p className="text-[9px] mb-0.5" style={{ color: "var(--color-faint)" }}>{a.date}</p>
                  <p className="text-[11px] leading-tight" style={{ color: a.bold ? "var(--color-ink)" : "var(--color-muted)", fontWeight: a.bold ? 600 : 400 }}>
                    {a.text}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
