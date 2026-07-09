"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChevronRight } from "lucide-react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ConnectGate, PageHeader, PageShell } from "@/components/pages/investor/chrome";
import { Panel, PanelLabel } from "@/components/pages/investor/surfaces";

/* ── Mock data ──────────────────────────────────────────────────── */
const ACCOUNT = {
  name: "Eval #4821",
  status: "Active Funded",
  size: 25000,
  equity: 27311,
  cum_pnl: -2311,
  win_rate: 52,
  trades: 41,
  risk: "Medium",
};

function genEquity(days: number) {
  let eq = 9500;
  let hwm = 9500;
  let mdd = 0;
  const data = [];
  for (let i = 0; i < days; i++) {
    eq = eq + (Math.random() - 0.46) * 120;
    eq = Math.max(8500, eq);
    hwm = Math.max(hwm, eq);
    const dd = hwm > 0 ? ((hwm - eq) / hwm) * 100 : 0;
    mdd = Math.max(mdd, dd);
    const target = 9500 + i * 30;
    data.push({
      day: i + 1,
      equity: Math.round(eq),
      target: Math.round(target),
      daily_dd: -Math.round(dd * 10) / 10,
      max_dd: -Math.round(mdd * 10) / 10,
    });
  }
  return data;
}

const EQUITY_DATA = genEquity(30);

function genPnl(days: number) {
  let v = 10000;
  return Array.from({ length: days }, (_, i) => {
    v += (Math.random() - 0.48) * 300;
    return { day: i + 1, pnl: Math.round(v) };
  });
}
const PNL_DATA = genPnl(30);

const POSITIONS = [
  { coin: "$LINK", dir: "Short", size: 15352, entry: "303.30 USD", mark: "23.19 USD", rpnl: "+$3.69", upnl: "-$93.69", opened: "2h 14m" },
  { coin: "$TRON", dir: "Long", size: 15352, entry: "443.50 USD", mark: "4.28 USD", rpnl: "+$2.45", upnl: "+$22.45", opened: "2h 14m" },
  { coin: "$HYPE", dir: "Short", size: 18352, entry: "502.00 USD", mark: "58.99 USD", rpnl: "-$1.69", upnl: "-$13.69", opened: "2h 14m" },
];

const MARCH_DAYS = [
  { d: 1, pnl: 61.94, trades: 12 }, { d: 2, pnl: 61.22, trades: 6 },
  { d: 3, pnl: 12.76, trades: 5 }, { d: 4, pnl: 41.11, trades: 7 },
  { d: 5, pnl: -99.39, trades: 12 }, { d: 6, pnl: -212.0, trades: 12 },
  { d: 7, pnl: 190.75, trades: 20 }, { d: 8, pnl: 215.88, trades: 25 },
  { d: 9, pnl: 95.41, trades: 35 }, { d: 10, pnl: null, trades: 0 },
  { d: 11, pnl: null, trades: 0 }, { d: 12, pnl: 220.69, trades: 25 },
  { d: 13, pnl: -23.45, trades: 3 }, { d: 14, pnl: null, trades: 0 },
  { d: 15, pnl: null, trades: 0 }, { d: 16, pnl: 100.55, trades: 25 },
  { d: 17, pnl: -141.41, trades: 35 }, { d: 18, pnl: 23.56, trades: 7 },
  { d: 19, pnl: null, trades: 0 }, { d: 20, pnl: 10.45, trades: 4 },
  { d: 21, pnl: null, trades: 0 }, { d: 22, pnl: null, trades: 0 },
  { d: 23, pnl: null, trades: 0 }, { d: 24, pnl: null, trades: 0 },
  { d: 25, pnl: null, trades: 0 }, { d: 26, pnl: null, trades: 0 },
  { d: 27, pnl: null, trades: 0 }, { d: 28, pnl: null, trades: 0 },
  { d: 29, pnl: null, trades: 0 }, { d: 30, pnl: null, trades: 0 },
  { d: 31, pnl: null, trades: 0 },
];

const STREAK = ["L", "L", "W", "W", "W", "L", "W", "W", "W", "L", "L"];

const CHART_TOOLTIP = {
  contentStyle: {
    background: "var(--color-panel-2)",
    border: "1px solid var(--color-line)",
    borderRadius: 8,
    fontSize: 12,
    fontFamily: "var(--font-mono)",
    fontWeight: 700,
  },
  itemStyle: { color: "var(--color-acid)" },
  labelStyle: { color: "var(--color-muted)", marginBottom: 4 },
} as const;

const AXIS_TICK = { fontSize: 10, fill: "var(--color-faint)", fontFamily: "var(--font-mono)" } as const;

/* ── Sub-components ─────────────────────────────────────────────── */
function StatBar({ label, value, pctWidth, color, foot }: {
  label: string;
  value: string;
  pctWidth: string;
  color: string;
  foot: React.ReactNode;
}) {
  return (
    <div className="mb-5">
      <PanelLabel className="mb-1.5">{label}</PanelLabel>
      <p className="mb-1.5 text-sm font-black text-ink tabular-nums">{value}</p>
      <div className="mb-1.5 h-1.5 overflow-hidden rounded-full bg-line">
        <div className="acid-bar h-full rounded-full" style={{ width: pctWidth, background: color }} />
      </div>
      <div className="flex justify-between text-[0.625rem] font-medium text-faint">{foot}</div>
    </div>
  );
}

function RightPanel() {
  return (
    <div className="flex w-full flex-col gap-4 xl:w-64 xl:shrink-0">
      {/* Risk & Rules */}
      <Panel className="group acid-int p-5">
        <div className="mb-4 flex items-center justify-between">
          <PanelLabel>Risk &amp; Rules</PanelLabel>
          <span className="font-mono text-[0.5625rem] font-medium text-faint">Reset 21:42:08</span>
        </div>

        <StatBar
          label="Daily Drawdown"
          value="20%"
          pctWidth="35%"
          color="linear-gradient(90deg, var(--color-acid), var(--color-cyan))"
          foot={
            <>
              <span>-$200.00 today</span>
              <span className="text-muted">$800.00 left</span>
            </>
          }
        />
        <StatBar
          label="Max Drawdown"
          value="2%"
          pctWidth="8%"
          color="var(--color-danger)"
          foot={
            <>
              <span>$0.0 total</span>
              <span className="text-muted">$3,000 left</span>
            </>
          }
        />

        <div className="rounded-lg border border-line bg-void p-3.5">
          <PanelLabel className="mb-1">Withdrawn</PanelLabel>
          <p className="text-lg font-black tracking-tight text-success tabular-nums">+$12,480</p>
          <p className="mt-1 flex items-center justify-between text-[0.5625rem] font-medium text-faint">
            Lifetime
            <span className="flex items-center gap-1 text-success">
              <span className="size-1.5 rounded-full bg-success" /> Paid out
            </span>
          </p>
        </div>
      </Panel>

      {/* Statistics */}
      <Panel className="group acid-int p-5">
        <div className="mb-4 flex items-center justify-between">
          <PanelLabel>Statistics</PanelLabel>
          <div className="flex gap-1">
            <button type="button" aria-label="Previous period" className="flex size-6 items-center justify-center rounded border border-line text-faint hover:bg-panel-2">
              <ChevronRight className="size-3 rotate-180" />
            </button>
            <button type="button" aria-label="Next period" className="flex size-6 items-center justify-center rounded border border-line text-faint hover:bg-panel-2">
              <ChevronRight className="size-3" />
            </button>
          </div>
        </div>
        <div className="space-y-3 text-xs">
          {(
            [
              ["Avg Win", "+$131.00", "text-success"],
              ["Avg Loss", "-$180.00", "text-danger"],
              ["Profit Factor", "2.09", "text-ink"],
              ["Expectancy", "+$65.00", "text-success"],
              ["Avg Hold", "69m", "text-ink"],
              ["Best Day", "-$419.00", "text-danger"],
              ["Worst Day", "-$706.00", "text-danger"],
              ["Risk / Reward", "1:0.73", "text-ink"],
            ] as const
          ).map(([k, v, c]) => (
            <div key={k} className="flex items-center justify-between border-b border-line pb-2 last:border-0 last:pb-0">
              <span className="font-medium text-faint">{k}</span>
              <span className={`font-bold tabular-nums ${c}`}>{v}</span>
            </div>
          ))}
        </div>
      </Panel>

      {/* Streak */}
      <Panel className="group acid-int p-5">
        <div className="mb-4 flex items-center justify-between">
          <PanelLabel>Streak</PanelLabel>
          <span className="rounded bg-danger/12 px-2 py-0.5 text-xs font-black text-danger">2L</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {STREAK.map((s, i) => (
            <div
              key={i}
              className={`flex size-7 items-center justify-center rounded border text-[0.6875rem] font-bold ${
                s === "W" ? "border-success/30 bg-success/12 text-success" : "border-danger/30 bg-danger/12 text-danger"
              }`}
            >
              {s}
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

function PositionsTable() {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Position</TableHead>
          <TableHead className="text-right">Net Size</TableHead>
          <TableHead className="text-right">Entry Price</TableHead>
          <TableHead className="text-right">Mark Price</TableHead>
          <TableHead className="text-right">Realized PnL</TableHead>
          <TableHead className="text-right">Unrealized PnL</TableHead>
          <TableHead className="text-right">Time Opened</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {POSITIONS.map((p) => {
          const isShort = p.dir === "Short";
          return (
            <TableRow key={p.coin} className="group">
              <TableCell>
                <div className="flex items-center gap-3">
                  <div className="flex size-8 items-center justify-center rounded-lg border border-line bg-panel-2 font-black text-ink">
                    {p.coin.replace("$", "")[0]}
                  </div>
                  <div>
                    <p className="text-sm font-bold tracking-tight text-ink">{p.coin}</p>
                    <p className={`text-[0.625rem] font-bold uppercase ${isShort ? "text-danger" : "text-success"}`}>
                      {p.dir}
                    </p>
                  </div>
                </div>
              </TableCell>
              <TableCell className="text-right font-bold tabular-nums">{p.size.toLocaleString()}</TableCell>
              <TableCell className="text-right tabular-nums text-muted transition-colors group-hover:text-ink motion-reduce:transition-none">{p.entry}</TableCell>
              <TableCell className="text-right tabular-nums text-ink">{p.mark}</TableCell>
              <TableCell className={`text-right font-bold tabular-nums ${p.rpnl.startsWith("-") ? "text-danger" : "text-success"}`}>
                {p.rpnl}
              </TableCell>
              <TableCell className={`text-right font-black tabular-nums ${p.upnl.startsWith("-") ? "text-danger" : "text-success"}`}>
                {p.upnl}
              </TableCell>
              <TableCell className="text-right tabular-nums text-faint">{p.opened}</TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

/* ── Page ───────────────────────────────────────────────────────── */
export default function DashboardPage() {
  const { connected } = useWallet();

  if (!connected) {
    return (
      <ConnectGate
        title="Connect your wallet"
        description="Connect your Phantom or Solflare wallet to access your dashboard, view performance metrics, and manage your account."
      />
    );
  }

  return (
    <PageShell width="wide">
      <PageHeader kicker="Trader" title="Dashboard" subtitle="Track and analyze your trading performance" />

      {/* Account row */}
      <Panel className="mb-6 flex flex-wrap items-center gap-8 border-l-2 border-l-acid p-5">
        <div className="min-w-[140px]">
          <PanelLabel className="mb-1">Account</PanelLabel>
          <p className="text-lg font-black tracking-tight text-ink">{ACCOUNT.name}</p>
          <p className="mt-0.5 text-[0.6875rem] font-medium text-muted">{ACCOUNT.status}</p>
        </div>
        {(
          [
            ["Size", `$${(ACCOUNT.size / 1000).toFixed(0)}k`, "text-ink"],
            ["Equity", `$${ACCOUNT.equity.toLocaleString()}`, "text-ink"],
            ["Cum. PnL", `-$${Math.abs(ACCOUNT.cum_pnl).toLocaleString()}`, "text-danger"],
            ["Win Rate", `${ACCOUNT.win_rate}%`, "text-ink"],
            ["Trades", `${ACCOUNT.trades}`, "text-ink"],
            ["Risk", ACCOUNT.risk, "text-ink"],
          ] as const
        ).map(([label, value, color]) => (
          <div key={label} className="flex flex-col border-l border-line pl-8 first:border-0 first:pl-0">
            <PanelLabel className="mb-1">{label}</PanelLabel>
            <span className={`font-mono text-lg font-black tracking-tight tabular-nums ${color}`}>{value}</span>
          </div>
        ))}
        <div className="ml-auto">
          <span className="flex items-center gap-1.5 rounded-md border border-success/30 bg-success/12 px-3 py-1.5 text-[0.6875rem] font-bold text-success">
            <span className="size-1.5 rounded-full bg-success motion-safe:animate-pulse" /> Active
          </span>
        </div>
      </Panel>

      {/* Main content + right panel */}
      <div className="flex flex-col gap-6 xl:flex-row">
        <div className="flex min-w-0 flex-1 flex-col gap-6">
          {/* Chart card */}
          <Panel className="overflow-hidden">
            <Tabs defaultValue="equity" className="gap-0">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line bg-panel-2 px-5 py-3">
                <TabsList>
                  <TabsTrigger value="equity">Account Equity</TabsTrigger>
                  <TabsTrigger value="pnl">PnL</TabsTrigger>
                  <TabsTrigger value="days">Trading Days</TabsTrigger>
                </TabsList>
                <div className="flex gap-1.5" aria-hidden>
                  {["1D", "7D", "30D", "ALL"].map((p) => (
                    <span
                      key={p}
                      className={`rounded-md border px-2.5 py-1 font-mono text-[0.625rem] font-bold ${
                        p === "30D" ? "border-acid/30 bg-acid/10 text-acid" : "border-transparent text-muted"
                      }`}
                    >
                      {p}
                    </span>
                  ))}
                </div>
              </div>

              <TabsContent value="equity" className="p-6">
                <ResponsiveContainer width="100%" height={260}>
                  <AreaChart data={EQUITY_DATA} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="eqAcid" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--color-acid)" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="var(--color-acid)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-line)" vertical={false} />
                    <XAxis dataKey="day" tick={AXIS_TICK} axisLine={false} tickLine={false} />
                    <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} />
                    <Tooltip {...CHART_TOOLTIP} />
                    <Area type="monotone" dataKey="equity" stroke="var(--color-acid)" strokeWidth={2} fill="url(#eqAcid)" name="Equity" activeDot={{ r: 4, fill: "var(--color-acid)", stroke: "var(--color-void)", strokeWidth: 2 }} />
                    <Line type="monotone" dataKey="target" stroke="var(--color-cyan)" strokeWidth={1} strokeDasharray="4 4" dot={false} name="Profit Target" />
                    <Line type="monotone" dataKey="daily_dd" stroke="var(--color-tier-advanced)" strokeWidth={1} strokeDasharray="4 4" dot={false} name="Daily DD" />
                    <Line type="monotone" dataKey="max_dd" stroke="var(--color-danger)" strokeWidth={1} strokeDasharray="4 4" dot={false} name="Max DD" />
                  </AreaChart>
                </ResponsiveContainer>
                <div className="mt-4 flex flex-wrap justify-center gap-5">
                  {(
                    [
                      ["var(--color-acid)", "Equity"],
                      ["var(--color-cyan)", "Profit Target"],
                      ["var(--color-tier-advanced)", "Daily Drawdown"],
                      ["var(--color-danger)", "Max Drawdown"],
                    ] as const
                  ).map(([color, label]) => (
                    <div key={label} className="flex items-center gap-2">
                      <span className="h-0.5 w-5 shrink-0" style={{ background: color }} />
                      <PanelLabel>{label}</PanelLabel>
                    </div>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="pnl" className="p-6">
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={PNL_DATA} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-line)" vertical={false} />
                    <XAxis dataKey="day" tick={AXIS_TICK} axisLine={false} tickLine={false} />
                    <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} />
                    <Tooltip {...CHART_TOOLTIP} />
                    <ReferenceLine y={10000} stroke="var(--color-line)" strokeDasharray="4 4" />
                    <Line type="monotone" dataKey="pnl" stroke="var(--color-acid)" strokeWidth={2} dot={false} name="PnL" activeDot={{ r: 4, fill: "var(--color-acid)", stroke: "var(--color-void)", strokeWidth: 2 }} />
                  </LineChart>
                </ResponsiveContainer>
              </TabsContent>

              <TabsContent value="days" className="p-6">
                <div className="mb-2 grid grid-cols-7 gap-2">
                  {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
                    <div key={d} className="py-1 text-center font-mono text-[0.625rem] font-bold tracking-widest text-faint uppercase">
                      {d}
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-2">
                  {Array(5)
                    .fill(null)
                    .map((_, i) => (
                      <div key={`e${i}`} className="rounded-lg border border-line bg-void opacity-20" />
                    ))}
                  {MARCH_DAYS.map((day) => (
                    <div
                      key={day.d}
                      className={`min-h-[70px] rounded-lg border p-2.5 ${
                        day.pnl == null
                          ? "border-line bg-void"
                          : day.pnl > 0
                            ? "border-success/30 bg-success/12"
                            : "border-danger/30 bg-danger/12"
                      }`}
                    >
                      <p className="mb-1 text-[0.625rem] font-bold text-muted">{day.d}</p>
                      {day.pnl != null ? (
                        <>
                          <p className={`text-[0.6875rem] font-black tracking-tight tabular-nums ${day.pnl > 0 ? "text-success" : "text-danger"}`}>
                            {day.pnl > 0 ? "+" : ""}${Math.abs(day.pnl).toFixed(2)}
                          </p>
                          {day.trades > 0 ? (
                            <p className="mt-1 text-[0.5625rem] font-medium text-faint">{day.trades} Trades</p>
                          ) : null}
                        </>
                      ) : null}
                    </div>
                  ))}
                </div>
              </TabsContent>
            </Tabs>
          </Panel>

          {/* Positions */}
          <Panel className="flex-1 overflow-hidden">
            <Tabs defaultValue="open" className="gap-0">
              <div className="flex items-center gap-4 border-b border-line bg-panel-2 px-5 py-3">
                <TabsList>
                  <TabsTrigger value="open">Open Positions</TabsTrigger>
                  <TabsTrigger value="history">Historical Trades</TabsTrigger>
                </TabsList>
                <div className="ml-auto">
                  <select
                    aria-label="Filter by asset"
                    className="cursor-pointer rounded-md border border-line bg-panel px-3 py-1.5 font-mono text-[0.625rem] font-bold tracking-widest text-ink uppercase outline-none"
                  >
                    <option>All Assets</option>
                  </select>
                </div>
              </div>
              <TabsContent value="open">
                <PositionsTable />
              </TabsContent>
              <TabsContent value="history">
                <PositionsTable />
              </TabsContent>
            </Tabs>
          </Panel>
        </div>

        <RightPanel />
      </div>
    </PageShell>
  );
}
