import { useEffect, useRef, useState, useCallback } from "react";
import { Layout } from "@/components/Layout";
import { cn } from "@/lib/utils";
import { useWallet } from "@/lib/wallet";
import { toast } from "sonner";
import { ArrowDownUp, AlertTriangle, ExternalLink, ShieldCheck, Star } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ARCADIA_EXECUTION_ENV, SOLANA_CLUSTER } from "@/lib/solana/constants";
import { useNavigate } from "react-router-dom";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Market {
    pair: string;
    base: string;
    price: number;
    change24h: number;
    vol24h: number;
}

interface TradeEntry {
    id: string;
    pair: string;
    amountIn: number;
    pnl: number;
    time: string;
    isNew: boolean;
}

interface Position {
    pair: string;
    side: "long" | "short";
    size: number;
    entry: number;
    mark: number;
    pnl: number;
    pnlPct: number;
}

// ─── Seed data ────────────────────────────────────────────────────────────────

const INIT_JR = 10_000;
const INIT_NAV = 12_840;

const SEED_MARKETS: Market[] = [
    { pair: "SOL/USDC",  base: "SOL",  price: 184.23,    change24h: 2.4,  vol24h: 124_500_000 },
    { pair: "BTC/USDC",  base: "BTC",  price: 67_812.1,  change24h: 1.1,  vol24h: 980_400_000 },
    { pair: "ETH/USDC",  base: "ETH",  price: 3_342.85,  change24h: -0.8, vol24h: 412_800_000 },
    { pair: "JUP/USDC",  base: "JUP",  price: 0.86,      change24h: 5.2,  vol24h: 18_400_000  },
    { pair: "WIF/USDC",  base: "WIF",  price: 2.14,      change24h: -3.4, vol24h: 32_100_000  },
    { pair: "BONK/USDC", base: "BONK", price: 0.000023,  change24h: 8.1,  vol24h: 14_200_000  },
];

const SEED_POSITIONS: Position[] = [
    { pair: "SOL/USDC", side: "long",  size: 1240, entry: 178.4,   mark: 184.23,    pnl: 7_223, pnlPct: 3.27 },
    { pair: "ETH/USDC", side: "short", size: 18,   entry: 3_380,   mark: 3_342.85,  pnl: 668,   pnlPct: 1.10 },
];

const SEED_TRADES: TradeEntry[] = [
    { id: "s1", pair: "USDC → SOL",  amountIn: 800, pnl:  24.3,  time: "14:32:11", isNew: false },
    { id: "s2", pair: "SOL → USDC",  amountIn: 600, pnl:  11.8,  time: "12:15:44", isNew: false },
    { id: "s3", pair: "USDC → JUP",  amountIn: 300, pnl:  -8.9,  time: "11:03:22", isNew: false },
    { id: "s4", pair: "USDC → SOL",  amountIn: 500, pnl:  31.2,  time: "09:47:05", isNew: false },
    { id: "s5", pair: "JUP → USDC",  amountIn: 200, pnl:   4.1,  time: "08:22:33", isNew: false },
];

function buildNavHistory(): number[] {
    const h: number[] = [];
    let v = INIT_JR;
    for (let i = 0; i < 90; i++) {
        v += (Math.random() - 0.42) * 52;
        v = Math.max(9_000, v);
        h.push(v);
    }
    h.push(INIT_NAV);
    return h;
}

function nowHMS(): string {
    const d = new Date();
    return [d.getHours(), d.getMinutes(), d.getSeconds()]
        .map(n => String(n).padStart(2, "0")).join(":");
}

function fmtCountdown(s: number): string {
    return [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60]
        .map(n => String(n).padStart(2, "0")).join(":");
}

function priceDp(m: Market): number {
    if (m.base === "BONK") return 8;
    if (m.price > 10_000) return 1;
    if (m.price > 100) return 2;
    if (m.price > 1) return 4;
    return 6;
}

// ─── NAV Line Chart ───────────────────────────────────────────────────────────

function NavLineChart({ history }: { history: number[] }) {
    const ref = useRef<HTMLCanvasElement>(null);

    const draw = useCallback(() => {
        const canvas = ref.current;
        if (!canvas || history.length < 2) return;
        const parent = canvas.parentElement;
        if (!parent) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const dpr = window.devicePixelRatio || 1;
        const W = parent.clientWidth;
        const H = parent.clientHeight;
        canvas.width  = W * dpr;
        canvas.height = H * dpr;
        canvas.style.width  = W + "px";
        canvas.style.height = H + "px";
        ctx.scale(dpr, dpr);
        ctx.clearRect(0, 0, W, H);

        const d  = history;
        const mn = Math.min(...d) * 0.995;
        const mx = Math.max(...d) * 1.005;
        const xp = (i: number) => (i / (d.length - 1)) * W;
        const yp = (v: number) => H - ((v - mn) / (mx - mn)) * (H - 20) - 8;

        // Grid lines
        const css = getComputedStyle(document.documentElement);
        const border = css.getPropertyValue("--border").trim();
        const muted = css.getPropertyValue("--muted-foreground").trim();
        ctx.strokeStyle = `hsl(${border} / 0.26)`;
        ctx.lineWidth = 0.5;
        for (let i = 1; i < 4; i++) {
            const y = 8 + (i / 4) * (H - 20);
            ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
        }

        // Y-axis labels
        ctx.font = "9px JetBrains Mono, monospace";
        ctx.fillStyle = `hsl(${muted} / 0.72)`;
        ctx.textAlign = "right";
        [mn, (mn + mx) / 2, mx].forEach(v => {
            const y = yp(v);
            if (y > 12 && y < H - 4) ctx.fillText(Math.round(v).toLocaleString(), W - 5, y - 2);
        });

        // Derive line color from CSS var
        const raw    = css.getPropertyValue("--primary").trim();
        const line   = `hsl(${raw})`;
        const fill0  = `hsl(${raw} / 0.18)`;
        const fill1  = `hsl(${raw} / 0)`;

        // Volume micro-bars
        ctx.fillStyle = `hsl(${raw} / 0.07)`;
        d.forEach((v, i) => {
            const bh = ((v - mn) / (mx - mn)) * H * 0.1 + 2;
            ctx.fillRect(xp(i) - 0.8, H - bh, 1.8, bh);
        });

        // Gradient fill
        const grad = ctx.createLinearGradient(0, 0, 0, H);
        grad.addColorStop(0, fill0);
        grad.addColorStop(1, fill1);

        const drawCurve = () => {
            ctx.beginPath();
            ctx.moveTo(xp(0), yp(d[0]));
            for (let i = 1; i < d.length; i++) {
                const cx = (xp(i - 1) + xp(i)) / 2;
                ctx.bezierCurveTo(cx, yp(d[i - 1]), cx, yp(d[i]), xp(i), yp(d[i]));
            }
        };

        drawCurve();
        ctx.lineTo(xp(d.length - 1), H);
        ctx.lineTo(xp(0), H);
        ctx.closePath();
        ctx.fillStyle = grad;
        ctx.fill();

        drawCurve();
        ctx.strokeStyle = line;
        ctx.lineWidth = 1.8;
        ctx.stroke();

        // End-point dot
        const lx = xp(d.length - 1);
        const ly = yp(d[d.length - 1]);
        ctx.beginPath(); ctx.arc(lx, ly, 6, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${raw} / 0.2)`; ctx.fill();
        ctx.beginPath(); ctx.arc(lx, ly, 3, 0, Math.PI * 2);
        ctx.fillStyle = line; ctx.fill();
    }, [history]);

    useEffect(() => {
        draw();
        const ro = new ResizeObserver(draw);
        if (ref.current?.parentElement) ro.observe(ref.current.parentElement);
        return () => ro.disconnect();
    }, [draw]);

    return <canvas ref={ref} className="absolute inset-0" />;
}

// ─── Swap Panel ───────────────────────────────────────────────────────────────

function SwapPanel({
    markets, nav, health, cooldown, onExecute, onOpenSurfpoolPreview,
}: {
    markets: Market[];
    nav: number;
    health: number;
    cooldown: number;
    onExecute: (pair: string, amtIn: number, pnl: number) => void;
    onOpenSurfpoolPreview: () => void;
}) {
    const { connected, role } = useWallet();
    const [amtIn, setAmtIn]     = useState("800");
    const [tokenOut, setTokenOut] = useState("SOL");
    const [pending, setPending]   = useState(false);
    const [devnetNoticeOpen, setDevnetNoticeOpen] = useState(false);

    const outMarket = markets.find(m => m.base === tokenOut) ?? markets[0];
    const amtInNum  = parseFloat(amtIn) || 0;
    const amtOut    = amtInNum > 0 ? amtInNum / outMarket.price : 0;
    const minOut    = amtOut * 0.995;
    const impact    = amtInNum > 500 ? "0.08%" : "0.04%";
    const bps       = health > 80 ? 10 : health > 50 ? 6 : health > 30 ? 3 : health > 10 ? 1 : 0;
    const maxTrade  = Math.floor((nav * bps) / 100);
    const isDevnetExecution = SOLANA_CLUSTER === "devnet" || ARCADIA_EXECUTION_ENV === "devnet";

    const canExec = connected && role === "trader" && cooldown === 0 && bps > 0 && amtInNum > 0 && amtInNum <= maxTrade;

    const execute = () => {
        if (!connected)        { toast.error("Connect a wallet first"); return; }
        if (role !== "trader") { toast.error("Switch to trader mode"); return; }
        if (cooldown > 0)      { toast.error(`Cooldown: ${fmtCountdown(cooldown)}`); return; }
        if (bps === 0)         { toast.error("Trading disabled — health critical"); return; }
        if (amtInNum > maxTrade) { toast.error(`Max trade: ${maxTrade.toLocaleString()} USDC`); return; }
        if (amtInNum <= 0)     { toast.error("Enter an amount"); return; }
        if (isDevnetExecution) {
            setDevnetNoticeOpen(true);
            return;
        }
        setPending(true);
        toast.loading("Simulating guarded quote…", { id: "swap" });
        setTimeout(() => {
            const pnl = (Math.random() - 0.43) * amtInNum * 0.07;
            onExecute(`USDC → ${tokenOut}`, amtInNum, pnl);
            setPending(false);
            toast.success("Simulation complete", {
                id: "swap",
                description: `${amtInNum.toLocaleString()} USDC → ${amtOut.toFixed(4)} ${tokenOut}`,
            });
        }, 1400);
    };

    const swapTokens = () => {
        const others = markets.filter(m => m.base !== "USDC");
        const idx = others.findIndex(m => m.base === tokenOut);
        setTokenOut(others[(idx + 1) % others.length]?.base ?? "SOL");
    };

    return (
        <div className="p-3 border-b border-border/30 shrink-0">
            <div className="font-mono text-[9px] uppercase tracking-[0.1em] text-muted-foreground mb-2.5">
                Execute Swap · Jupiter
            </div>

            {/* You sell */}
            <div className="rounded-lg bg-card/30 border border-border/40 focus-within:border-primary/30 p-2.5 mb-1 transition-colors">
                <div className="font-mono text-[8px] uppercase tracking-[0.06em] text-muted-foreground mb-1.5">You sell</div>
                <div className="flex items-center gap-2">
                    <input
                        type="number"
                        value={amtIn}
                        onChange={e => setAmtIn(e.target.value)}
                        className="flex-1 bg-transparent border-0 outline-none font-display text-[18px] font-semibold text-foreground w-0 min-w-0 tabular-nums"
                        placeholder="0.00"
                    />
                    <div className="flex items-center gap-1.5 px-2 py-1 bg-card border border-border/50 rounded-md font-mono text-[9px] text-foreground shrink-0">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary/60" />
                        USDC
                    </div>
                </div>
                <button
                    onClick={() => setAmtIn(String(maxTrade))}
                    className="font-mono text-[8px] text-primary/70 hover:text-primary mt-1 transition-colors"
                >
                    MAX: {maxTrade.toLocaleString()} USDC
                </button>
            </div>

            {/* Mid row */}
            <div className="flex items-center justify-between py-1.5 px-0.5 mb-1">
                <div className="font-mono text-[8px] text-muted-foreground">
                    USDC → {tokenOut} via Jupiter
                </div>
                <button
                    onClick={swapTokens}
                    className="w-6 h-6 rounded-md bg-card border border-border/50 flex items-center justify-center text-muted-foreground hover:border-primary/40 hover:text-primary transition-colors"
                >
                    <ArrowDownUp className="w-3 h-3" />
                </button>
            </div>

            {/* You receive */}
            <div className="rounded-lg bg-card/30 border border-border/40 p-2.5 mb-2.5">
                <div className="font-mono text-[8px] uppercase tracking-[0.06em] text-muted-foreground mb-1.5">You receive</div>
                <div className="flex items-center gap-2">
                    <div className="flex-1 font-display text-[18px] font-semibold text-foreground/50 tabular-nums">
                        {amtOut > 0 ? amtOut.toFixed(4) : "~"}
                    </div>
                    <select
                        value={tokenOut}
                        onChange={e => setTokenOut(e.target.value)}
                        className="px-2 py-1 bg-card border border-border/50 rounded-md font-mono text-[9px] text-foreground outline-none cursor-pointer shrink-0"
                    >
                        {markets.filter(m => m.base !== "USDC").map(m => (
                            <option key={m.base} value={m.base}>{m.base}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Quote */}
            <div className="rounded-lg bg-card/20 border border-border/30 p-2 mb-2.5 space-y-1">
                {([
                    ["Price impact", impact],
                    ["Min received", amtOut > 0 ? `${minOut.toFixed(4)} ${tokenOut}` : "—"],
                    ["Slippage",     "0.50%"],
                    ["Route",        `USDC → w${tokenOut}`],
                ] as [string, string][]).map(([k, v]) => (
                    <div key={k} className="flex justify-between font-mono text-[9px]">
                        <span className="text-muted-foreground">{k}</span>
                        <span className="text-foreground/70">{v}</span>
                    </div>
                ))}
            </div>

            {/* Execute */}
            <button
                onClick={execute}
                disabled={pending}
                className={cn(
                    "w-full py-2.5 rounded-lg font-display font-bold text-[12px] tracking-[0.04em]",
                    "border border-primary/30 bg-primary/5 text-primary",
                    "hover:bg-primary hover:text-primary-foreground hover:border-primary",
                    "disabled:opacity-30 disabled:cursor-not-allowed",
                    "transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                )}
            >
                {pending
                    ? "Simulating guarded quote…"
                    : isDevnetExecution
                      ? "Preview devnet limitation"
                      : "Simulate guarded quote"}
            </button>
            <Dialog open={devnetNoticeOpen} onOpenChange={setDevnetNoticeOpen}>
                <DialogContent className="surface-elevated border-border-strong sm:max-w-md">
                    <DialogHeader>
                        <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                            <ShieldCheck className="h-5 w-5" />
                        </div>
                        <DialogTitle>Jupiter execution is mainnet-only</DialogTitle>
                        <DialogDescription>
                            Arcadia devnet can verify vault limits, NAV, liquidity, deposits, and withdrawals with real wallet
                            transactions. Jupiter swap execution is shown through Surfpool, using live quotes with local simulation.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-1 rounded-lg border border-border/50 bg-card/40 p-3 font-mono text-[10px] text-muted-foreground">
                        <div className="flex justify-between gap-4">
                            <span>Devnet action</span>
                            <span className="text-foreground">Guard + accounting</span>
                        </div>
                        <div className="flex justify-between gap-4">
                            <span>Jupiter route</span>
                            <span className="text-foreground">Surfpool preview</span>
                        </div>
                        <div className="flex justify-between gap-4">
                            <span>Mainnet funds</span>
                            <span className="text-primary">Not touched</span>
                        </div>
                    </div>
                    <button
                        onClick={onOpenSurfpoolPreview}
                        className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                    >
                        Open Surfpool preview <ExternalLink className="h-4 w-4" />
                    </button>
                </DialogContent>
            </Dialog>
        </div>
    );
}

// ─── Trade Feed ───────────────────────────────────────────────────────────────

function TradeFeed({ trades }: { trades: TradeEntry[] }) {
    return (
        <div className="flex flex-col flex-1 overflow-hidden min-h-0">
            <div className="flex items-center justify-between px-3 py-2 border-b border-border/30 shrink-0">
                <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-muted-foreground">Trade Feed</span>
                <span className="font-mono text-[9px] px-1.5 py-0.5 bg-card/60 rounded text-muted-foreground">{trades.length}</span>
            </div>
            <div className="flex-1 overflow-y-auto scrollbar-none">
                {trades.length === 0 ? (
                    <div className="p-4 text-center font-mono text-[10px] text-muted-foreground">No trades yet</div>
                ) : (
                    trades.map((t, i) => (
                        <div
                            key={t.id}
                            className={cn(
                                "grid grid-cols-[1fr_auto] gap-0.5 px-3 py-2 border-b border-border/20 transition-colors",
                                i === 0 && t.isNew
                                    ? "border-l-[2px] border-l-primary bg-primary/[0.04]"
                                    : "hover:bg-card/30"
                            )}
                        >
                            <div className="font-mono text-[10px] font-medium text-foreground">{t.pair}</div>
                            <div className={cn(
                                "font-mono text-[10px] font-semibold text-right tabular-nums",
                                t.pnl >= 0 ? "text-foreground/80" : "text-muted-foreground"
                            )}>
                                {t.pnl >= 0 ? "+" : ""}{t.pnl.toFixed(2)}
                            </div>
                            <div className="font-mono text-[8px] text-muted-foreground">
                                {t.amountIn.toLocaleString()} USDC in
                            </div>
                            <div className="font-mono text-[8px] text-muted-foreground text-right">{t.time}</div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const Trade = () => {
    const { connected, role } = useWallet();
    const navigate = useNavigate();

    // Market state (live ticking)
    const [markets, setMarkets]         = useState<Market[]>(SEED_MARKETS);
    const [activeMarket, setActiveMarket] = useState<Market>(SEED_MARKETS[0]);

    // Vault / NAV state
    const [nav,      setNav]      = useState(INIT_NAV);
    const [jr,       setJr]       = useState(INIT_NAV);
    const [health,   setHealth]   = useState((INIT_NAV / INIT_JR) * 100);
    const [cooldown, setCooldown] = useState(0);
    const [navHist,  setNavHist]  = useState<number[]>(buildNavHistory);

    // Trade data
    const [trades,    setTrades]    = useState<TradeEntry[]>(SEED_TRADES);
    const [positions, setPositions] = useState<Position[]>(SEED_POSITIONS);

    // UI state
    const [timeframe, setTimeframe] = useState("1H");
    const [posTab,    setPosTab]    = useState<"positions" | "history">("positions");

    // Derived
    const pnlAbs = nav - INIT_JR;
    const pnlPct = (pnlAbs / INIT_JR) * 100;
    const bps    = health > 80 ? 10 : health > 50 ? 6 : health > 30 ? 3 : health > 10 ? 1 : 0;

    // ── Add trade ──
    const addTrade = useCallback((pair: string, amountIn: number, pnl: number) => {
        const entry: TradeEntry = {
            id: `t${Date.now()}`,
            pair, amountIn, pnl,
            time: nowHMS(),
            isNew: true,
        };
        setTrades(prev => {
            const next = [entry, ...prev].slice(0, 30);
            setTimeout(() =>
                setTrades(cur => cur.map((t, i) => i === 0 ? { ...t, isNew: false } : t))
            , 600);
            return next;
        });
        setNav(n => {
            const nNext = n + pnl;
            setJr(j => {
                const jNext = j + pnl;
                const h = (jNext / INIT_JR) * 100;
                setHealth(h);
                const drop = Math.abs(pnl) / nNext * 100;
                if (pnl < 0 && drop > 3)   setCooldown(7200);
                else if (pnl < 0 && drop > 1.5) setCooldown(1200);
                return jNext;
            });
            setNavHist(h => [...h.slice(-119), nNext]);
            return nNext;
        });
    }, []);

    // ── Price tick (500 ms) ──
    useEffect(() => {
        const id = setInterval(() => {
            setMarkets(prev => prev.map(m => ({
                ...m,
                price: +(m.price * (1 + (Math.random() - 0.5) * 0.001))
                    .toFixed(priceDp(m)),
            })));
        }, 500);
        return () => clearInterval(id);
    }, []);

    // Keep active market price in sync
    useEffect(() => {
        setActiveMarket(prev =>
            markets.find(m => m.pair === prev.pair) ?? prev
        );
    }, [markets]);

    // ── NAV drift (2.2 s) ──
    useEffect(() => {
        const id = setInterval(() => {
            if (cooldown > 0) return;
            const d = (Math.random() - 0.45) * 9;
            setNav(n => { const nxt = n + d; setJr(j => { const jn = j + d; setHealth((jn/INIT_JR)*100); return jn; }); setNavHist(h=>[...h.slice(-119),nxt]); return nxt; });
        }, 2200);
        return () => clearInterval(id);
    }, [cooldown]);

    // ── Cooldown countdown (1 s) ──
    useEffect(() => {
        const id = setInterval(() => setCooldown(c => c > 0 ? c - 1 : 0), 1000);
        return () => clearInterval(id);
    }, []);

    // ── Background random trades (7–13 s) ──
    useEffect(() => {
        const PAIRS = ["USDC → SOL","USDC → JUP","SOL → USDC","JUP → USDC"];
        let timer: ReturnType<typeof setTimeout>;
        const schedule = () => {
            timer = setTimeout(() => {
                const pair = PAIRS[Math.floor(Math.random() * PAIRS.length)];
                const amt  = 80 + Math.floor(Math.random() * 550);
                addTrade(pair, amt, (Math.random() - 0.44) * amt * 0.07);
                schedule();
            }, 7000 + Math.random() * 6000);
        };
        schedule();
        return () => clearTimeout(timer);
    }, [addTrade]);

    return (
        <Layout hideFooter>
            {/* ── Main layout ─────────────────────────────────────────────────── */}
            <div className="flex h-[calc(100vh-3.75rem)] overflow-hidden">

                {/* ─ LEFT: Market list ─ */}
                <aside className="hidden lg:flex w-48 shrink-0 flex-col border-r border-border/30 overflow-hidden">
                    <div className="font-mono text-[9px] uppercase tracking-[0.1em] text-muted-foreground px-3 py-2.5 border-b border-border/30">
                        Markets
                    </div>
                    <div className="flex-1 overflow-y-auto">
                        {markets.map(m => (
                            <button
                                key={m.pair}
                                onClick={() => setActiveMarket(m)}
                                className={cn(
                                    "w-full grid grid-cols-[1fr_auto] gap-1 px-3 py-2.5 text-left",
                                    "border-b border-border/20 hover:bg-card/40 transition-colors focus-visible:outline-none",
                                    m.pair === activeMarket.pair && "bg-card/60 border-l-[2px] border-l-primary"
                                )}
                            >
                                <div>
                                    <div className="font-mono text-[10px] font-medium text-foreground flex items-center gap-1">
                                        <Star className="w-2.5 h-2.5 text-muted-foreground/40 shrink-0" />
                                        {m.pair}
                                    </div>
                                    <div className="font-mono text-[9px] text-muted-foreground tabular-nums mt-0.5">
                                        ${m.price.toLocaleString(undefined, { maximumFractionDigits: priceDp(m) })}
                                    </div>
                                </div>
                                <div className={cn(
                                    "font-mono text-[9px] tabular-nums self-center",
                                    m.change24h >= 0 ? "text-foreground/70" : "text-muted-foreground"
                                )}>
                                    {m.change24h >= 0 ? "+" : ""}{m.change24h.toFixed(1)}%
                                </div>
                            </button>
                        ))}
                    </div>
                </aside>

                {/* ─ CENTER ─ */}
                <div className="flex-1 flex flex-col overflow-hidden min-w-0">

                    {/* Ticker strip */}
                    <div className="border-b border-border/30 flex items-center overflow-x-auto shrink-0 h-10">
                        {markets.slice(0, 5).map(m => (
                            <button
                                key={m.pair}
                                onClick={() => setActiveMarket(m)}
                                className={cn(
                                    "flex items-center gap-2 px-3 h-full border-r border-border/20 shrink-0",
                                    "hover:bg-card/40 transition-colors focus-visible:outline-none",
                                    m.pair === activeMarket.pair && "bg-card/30"
                                )}
                            >
                                <span className="font-mono text-[10px] font-medium text-foreground">{m.pair}</span>
                                <span className="font-mono text-[10px] text-muted-foreground tabular-nums">
                                    {m.price.toLocaleString(undefined, { maximumFractionDigits: priceDp(m) })}
                                </span>
                                <span className={cn(
                                    "font-mono text-[9px] px-1 py-px rounded-sm",
                                    m.change24h >= 0 ? "bg-foreground/5 text-foreground/65" : "bg-muted/20 text-muted-foreground"
                                )}>
                                    {m.change24h >= 0 ? "+" : ""}{m.change24h.toFixed(1)}%
                                </span>
                            </button>
                        ))}
                    </div>

                    {/* Chart area */}
                    <div className="flex-1 flex flex-col overflow-hidden min-h-0 p-4">
                        {/* Header */}
                        <div className="flex items-start justify-between mb-3 shrink-0">
                            <div>
                                <div className="font-mono text-[9px] uppercase tracking-[0.08em] text-muted-foreground mb-1">
                                    Vault NAV · USDC
                                </div>
                                <div className="font-display text-[28px] font-bold text-foreground tracking-tight leading-none tabular-nums">
                                    {nav.toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </div>
                                <div className="flex items-center gap-2 mt-2">
                                    <span className={cn(
                                        "font-mono text-[10px] px-1.5 py-0.5 rounded-sm",
                                        pnlAbs >= 0 ? "bg-foreground/5 text-foreground/80" : "bg-muted/20 text-muted-foreground"
                                    )}>
                                        {pnlAbs >= 0 ? "+" : ""}{pnlPct.toFixed(1)}%
                                    </span>
                                    <span className="font-mono text-[10px] text-muted-foreground">
                                        {pnlAbs >= 0 ? "+" : ""}{pnlAbs.toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} since inception
                                    </span>
                                </div>
                            </div>
                            <div className="flex items-center gap-1">
                                {["1H", "6H", "1D", "ALL"].map(tf => (
                                    <button
                                        key={tf}
                                        onClick={() => setTimeframe(tf)}
                                        className={cn(
                                            "font-mono text-[9px] px-2 py-1 rounded border transition-colors focus-visible:outline-none",
                                            timeframe === tf
                                                ? "bg-card border-border/60 text-foreground"
                                                : "border-transparent text-muted-foreground hover:text-foreground"
                                        )}
                                    >
                                        {tf}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Canvas chart */}
                        <div className="flex-1 min-h-0 relative overflow-hidden">
                            <NavLineChart history={navHist} />
                        </div>
                    </div>

                    {/* ── Metrics bar ── */}
                    <div className="border-t border-border/30 grid grid-cols-4 shrink-0">
                        {[
                            { label: "Total NAV",      value: nav.toLocaleString("en", { minimumFractionDigits: 0, maximumFractionDigits: 0 }), sub: `${pnlAbs >= 0 ? "+" : ""}${pnlAbs.toFixed(2)} USDC` },
                            { label: "Junior Capital",  value: jr.toLocaleString("en",  { minimumFractionDigits: 0, maximumFractionDigits: 0 }), sub: `${((jr / nav) * 100).toFixed(0)}% of vault` },
                            { label: "Jr Health",       value: `${health.toFixed(0)}%`, sub: health > 80 ? "Full access" : health > 50 ? "Restricted" : health > 20 ? "Critical" : "DISABLED" },
                            { label: "Unrealised PnL",  value: `${pnlAbs >= 0 ? "+" : ""}${pnlPct.toFixed(1)}%`, sub: `${pnlAbs >= 0 ? "+" : ""}${pnlAbs.toFixed(2)} USDC` },
                        ].map((m, i) => (
                            <div key={m.label} className={cn("px-4 py-3 relative overflow-hidden", i < 3 && "border-r border-border/30")}>
                                <div className="font-mono text-[9px] uppercase tracking-[0.08em] text-muted-foreground mb-1">{m.label}</div>
                                <div className="font-display text-[16px] font-semibold text-foreground tabular-nums leading-none">{m.value}</div>
                                <div className="font-mono text-[9px] text-muted-foreground mt-1 tabular-nums">{m.sub}</div>
                                <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-primary/20" />
                            </div>
                        ))}
                    </div>

                    {/* ── Positions / History tabs ── */}
                    <div className="border-t border-border/30 shrink-0">
                        <div className="flex items-center border-b border-border/30 px-3">
                            {(["positions", "history"] as const).map(t => (
                                <button
                                    key={t}
                                    onClick={() => setPosTab(t)}
                                    className={cn(
                                        "relative h-9 px-4 font-mono text-[9px] uppercase tracking-[0.1em] transition-colors focus-visible:outline-none",
                                        posTab === t ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                                    )}
                                >
                                    {t}
                                    {posTab === t && <span className="absolute bottom-0 left-1 right-1 h-px bg-primary" />}
                                </button>
                            ))}
                            <span className="ml-auto font-mono text-[9px] text-muted-foreground pr-2">{activeMarket.pair}</span>
                        </div>

                        <div className="overflow-x-auto max-h-36">
                            {posTab === "positions" && (
                                <table className="w-full font-mono text-[10px]">
                                    <thead>
                                        <tr className="text-muted-foreground text-[9px] uppercase tracking-wider">
                                            {["Pair","Side","Size","Entry","Mark","PnL",""].map((h, i) => (
                                                <th key={i} className={cn("py-2 px-3 font-normal", i >= 2 ? "text-right" : "text-left")}>{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {positions.length === 0 ? (
                                            <tr><td colSpan={7} className="py-4 px-3 text-center text-muted-foreground text-[10px]">No open positions</td></tr>
                                        ) : positions.map(p => (
                                            <tr key={p.pair} className="border-t border-border/20 hover:bg-card/30 transition-colors">
                                                <td className="py-2 px-3">{p.pair}</td>
                                                <td className="px-3 text-foreground/70 font-semibold">{p.side.toUpperCase()}</td>
                                                <td className="px-3 text-right tabular-nums">{p.size.toLocaleString()}</td>
                                                <td className="px-3 text-right tabular-nums">${p.entry.toLocaleString()}</td>
                                                <td className="px-3 text-right tabular-nums">${p.mark.toLocaleString()}</td>
                                                <td className={cn("px-3 text-right tabular-nums", p.pnl >= 0 ? "text-foreground/80" : "text-muted-foreground")}>
                                                    {p.pnl >= 0 ? "+" : ""}${p.pnl.toLocaleString()} ({p.pnl >= 0 ? "+" : ""}{p.pnlPct.toFixed(1)}%)
                                                </td>
                                                <td className="px-3 text-right">
                                                    <button
                                                        onClick={() => { setPositions(x => x.filter(q => q.pair !== p.pair)); toast.success("Position close queued"); }}
                                                        className="font-mono text-[8px] px-1.5 py-0.5 rounded border border-border/40 text-muted-foreground hover:text-foreground hover:border-border/70 transition-colors"
                                                    >
                                                        Close
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                            {posTab === "history" && (
                                <table className="w-full font-mono text-[10px]">
                                    <thead>
                                        <tr className="text-muted-foreground text-[9px] uppercase tracking-wider">
                                            {["Pair","Direction","Amount","PnL","Fee","Time"].map((h, i) => (
                                                <th key={i} className={cn("py-2 px-3 font-normal", i >= 2 ? "text-right" : "text-left")}>{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {trades.slice(0, 10).map(t => (
                                            <tr key={t.id} className="border-t border-border/20 hover:bg-card/30 transition-colors">
                                                <td className="py-2 px-3">{t.pair}</td>
                                                <td className="px-3 text-foreground/60">{t.pair.startsWith("USDC") ? "BUY" : "SELL"}</td>
                                                <td className="px-3 text-right tabular-nums">{t.amountIn.toLocaleString()} USDC</td>
                                                <td className={cn("px-3 text-right tabular-nums", t.pnl >= 0 ? "text-foreground/80" : "text-muted-foreground")}>
                                                    {t.pnl >= 0 ? "+" : ""}{t.pnl.toFixed(2)}
                                                </td>
                                                <td className="px-3 text-right tabular-nums text-muted-foreground">{(t.amountIn * 0.001).toFixed(2)}</td>
                                                <td className="px-3 text-right text-muted-foreground">{t.time}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>
                </div>

                {/* ─ RIGHT PANEL: Vault + Swap + Feed ─ */}
                <aside className="w-[272px] shrink-0 flex flex-col border-l border-border/30 overflow-hidden">

                    {/* Vault hero */}
                    <div className="p-3 border-b border-border/30 shrink-0">
                        <div className="flex items-center justify-between mb-2.5">
                            <div className="font-display font-semibold text-[13px] text-foreground">Alpha Vault #1</div>
                            <span className="font-mono text-[8px] px-1.5 py-0.5 rounded border border-border/40 text-muted-foreground">
                                PAPER MODE
                            </span>
                        </div>
                        <div className="h-[3px] bg-card/60 rounded-full overflow-hidden mb-1.5">
                            <div className="h-full bg-primary/50 rounded-full" style={{ width: "40%" }} />
                        </div>
                        <div className="flex justify-between font-mono text-[8px] mb-2.5">
                            <span className="text-primary/70">Day 12 / 30</span>
                            <span className="text-muted-foreground">18 days left</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="font-mono text-[8px] uppercase tracking-[0.08em] text-muted-foreground">Junior Health</span>
                            <span className="font-display font-bold text-[15px] text-foreground tabular-nums">{health.toFixed(0)}%</span>
                        </div>
                    </div>

                    {/* Position limits */}
                    <div className="p-3 border-b border-border/30 shrink-0">
                        <div className="font-mono text-[9px] uppercase tracking-[0.1em] text-muted-foreground mb-2">
                            Position Limits
                        </div>
                        <div className="h-[3px] bg-card/60 rounded-full overflow-hidden mb-3">
                            <div
                                className="h-full rounded-full transition-all duration-500"
                                style={{
                                    width: `${Math.min(100, health)}%`,
                                    background: health > 80
                                        ? "hsl(var(--primary))"
                                        : health > 50
                                        ? "hsl(var(--primary)/0.55)"
                                        : "hsl(var(--muted-foreground))",
                                }}
                            />
                        </div>
                        {([
                            ["Max position", `${bps}% of NAV`],
                            ["Max trade",    `${Math.floor((nav * bps) / 100).toLocaleString()} USDC`],
                            ["Cooldown",     cooldown > 0 ? fmtCountdown(cooldown) : "None active"],
                            ["Instant exit", health < 20 ? "UNLOCKED" : "Locked"],
                        ] as [string, string][]).map(([k, v]) => (
                            <div key={k} className="flex justify-between items-center py-1.5 border-b border-border/20 last:border-0">
                                <span className="text-[10px] text-muted-foreground">{k}</span>
                                <span className="font-mono text-[10px] text-foreground/80">{v}</span>
                            </div>
                        ))}
                    </div>

                    {/* Swap */}
                    <SwapPanel
                        markets={markets}
                        nav={nav}
                        health={health}
                        cooldown={cooldown}
                        onExecute={addTrade}
                        onOpenSurfpoolPreview={() => navigate("/demo-control")}
                    />

                    {/* Alert */}
                    {(cooldown > 0 || health < 20) && (
                        <div className="mx-3 my-2 p-2 rounded-md border border-border/30 bg-card/20 flex items-start gap-2 shrink-0">
                            <AlertTriangle className="w-3 h-3 text-muted-foreground mt-0.5 shrink-0" />
                            <p className="font-mono text-[8px] text-muted-foreground leading-relaxed">
                                {cooldown > 0
                                    ? `Trade cooldown active — ${fmtCountdown(cooldown)}`
                                    : "Critical: junior health below 20% — instant exit unlocked"}
                            </p>
                        </div>
                    )}

                    {/* Feed */}
                    <TradeFeed trades={trades} />

                </aside>
            </div>
        </Layout>
    );
};

export default Trade;
