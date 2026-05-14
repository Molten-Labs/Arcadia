import { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useWallet, shortAddr } from "@/lib/wallet";
import { Button } from "@/components/ui/button";
import {
    Wallet,
    Menu,
    X,
    ChevronDown,
    LogOut,
    Globe2,
    LayoutDashboard,
    Bell,
    TrendingDown,
    ShieldAlert,
    AlertTriangle,
    Zap,
    Award,
    DollarSign,
    ExternalLink,
    Check,
    CheckCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
    DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { ArcadiaLogo, ArcadiaWordmark } from "@/components/ArcadiaLogo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ConnectModal } from "@/components/ConnectModal";
import { DevnetUsdcFaucet } from "@/components/DevnetUsdcFaucet";
import { DemoTriggerButton } from "@/components/DemoRunner";
import { useRealtimeStatus } from "@/hooks/realtimeContext";
import type { Alert } from "@/lib/mockData";
import { mockStore } from "@/lib/mockStore";
import { formatDistanceToNow } from "date-fns";

const KIND_META: Record<Alert["kind"], { icon: React.ElementType; color: string }> = {
    cooldown:       { icon: TrendingDown,  color: "text-warning" },
    freeze:         { icon: ShieldAlert,   color: "text-destructive" },
    junior_low:     { icon: AlertTriangle, color: "text-warning" },
    instant_exit:   { icon: Zap,          color: "text-primary" },
    graduate:       { icon: Award,         color: "text-success" },
    fee:            { icon: DollarSign,    color: "text-success" },
    paper_complete: { icon: Award,         color: "text-success" },
};

export const Nav = () => {
    const { connected, address, publicKey, role, network, walletName, setRole, disconnect } = useWallet();
    const { status, lastEventAt } = useRealtimeStatus();
    const [open, setOpen] = useState(false);
    const [connectOpen, setConnectOpen] = useState(false);
    const [bellOpen, setBellOpen] = useState(false);
    const [, forceRender] = useState(0);
    const [readSet, setReadSet] = useState<Set<string>>(
        () => new Set(mockStore.alerts.filter((a) => a.read).map((a) => a.id))
    );
    const location = useLocation();

    useEffect(() => {
        const handler = () => forceRender(n => n + 1);
        window.addEventListener("kiln:mock-update", handler);
        return () => window.removeEventListener("kiln:mock-update", handler);
    }, []);

    const alerts = mockStore.alerts.map((a) => ({ ...a, read: readSet.has(a.id) }))
        .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());

    const unread = alerts.filter((a) => !a.read).length;

    const markRead = (id: string) =>
        setReadSet((prev) => new Set([...prev, id]));

    const markAllRead = () =>
        setReadSet(new Set(mockStore.alerts.map((a) => a.id)));

    const publicLinks = [
        { to: "/vaults", label: "Marketplace" },
        { to: "/traders", label: "Traders" },
        { to: "/how-it-works", label: "How It Works" },
        { to: "/docs", label: "Docs" },
    ];

    const investorLinks = [
        { to: "/vaults", label: "Marketplace" },
        { to: "/portfolio", label: "Portfolio" },
        { to: "/traders", label: "Traders" },
    ];

    const traderLinks = [
        { to: "/manager", label: "Dashboard" },
        { to: "/trade", label: "Trade" },
        { to: "/manager/create", label: "New vault" },
    ];

    const links = !connected ? publicLinks : role === "trader" ? traderLinks : investorLinks;
    const showDemoTrigger = true;
    const secondaryLinks = connected
        ? role === "trader"
            ? [
                { to: "/traders", label: "Directory" },
                { to: "/how-it-works", label: "How It Works" },
                { to: "/docs", label: "Docs" },
            ]
            : [
                { to: "/how-it-works", label: "How It Works" },
                { to: "/docs", label: "Docs" },
                { to: "/settings", label: "Settings" },
            ]
        : [];

    const realtimeLabel =
        status === "live"
            ? "Live"
            : status === "reconnecting"
                ? "Reconnecting"
                : status === "connecting"
                    ? "Connecting"
                    : status === "polling"
                        ? "Polling"
                        : "Demo";

    const isActive = (to: string) =>
        location.pathname === to || (to !== "/" && location.pathname.startsWith(to));

    const navigate = useNavigate();

    const switchRole = (nextRole: typeof role) => {
        if (nextRole === role) return;
        setRole(nextRole);
        navigate("/");
        toast.success(`Switched to ${nextRole === "trader" ? "Trader" : "Investor"} mode`);
    };

    return (
        <>
            <header className="sticky top-0 z-40 border-b border-border/40 bg-background/88 shadow-[0_10px_36px_hsl(var(--foreground)/0.05)] backdrop-blur-xl">
                <div className="container grid h-16 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 lg:grid-cols-[minmax(17rem,1fr)_auto_minmax(17rem,1fr)]">
                    <div className="flex min-w-0 items-center">
                        <Link to="/" className="group flex min-w-0 shrink-0 items-center gap-2.5">
                            <ArcadiaLogo className="transition-transform duration-200 group-hover:translate-x-0.5" />
                            <ArcadiaWordmark className="max-w-[14.5rem] truncate" />
                        </Link>
                    </div>

                    <nav className="hidden items-center justify-center gap-1 lg:flex">
                        {links.map((l) =>
                            "to" in l ? (
                                <Link
                                    key={l.to}
                                    to={l.to}
                                    className={cn(
                                        "relative px-3.5 py-2 text-[13px] font-medium rounded-lg transition-colors",
                                        "after:absolute after:inset-x-2.5 after:bottom-0.5 after:h-px after:origin-center",
                                        "after:scale-x-0 after:rounded-full after:bg-primary after:transition-transform",
                                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                                        isActive(l.to)
                                            ? "text-foreground after:scale-x-100"
                                            : "text-muted-foreground hover:text-foreground hover:bg-secondary/70"
                                    )}
                                >
                                    {l.label}
                                </Link>
                            ) : (
                                <button
                                    key={l.label}
                                    onClick={l.action}
                                    className={cn(
                                        "relative px-3.5 py-2 text-[13px] font-medium rounded-lg transition-colors",
                                        "after:absolute after:inset-x-2.5 after:bottom-0.5 after:h-px after:origin-center",
                                        "after:scale-x-0 after:rounded-full after:bg-primary after:transition-transform",
                                        "text-muted-foreground hover:text-foreground hover:bg-secondary/70",
                                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                    )}
                                >
                                    {l.label}
                                </button>
                            )
                        )}
                        {secondaryLinks.length > 0 && (
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <button
                                        className={cn(
                                            "relative inline-flex h-10 items-center gap-1.5 rounded-lg px-3 py-2 text-[13px] font-medium text-muted-foreground transition-colors",
                                            "hover:bg-secondary/70 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                                            secondaryLinks.some((l) => isActive(l.to)) && "text-foreground"
                                        )}
                                    >
                                        More
                                        <ChevronDown className="h-3.5 w-3.5" />
                                    </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="center" className="w-48">
                                    {secondaryLinks.map((link) => (
                                        <DropdownMenuItem key={link.to} asChild>
                                            <Link to={link.to}>{link.label}</Link>
                                        </DropdownMenuItem>
                                    ))}
                                </DropdownMenuContent>
                            </DropdownMenu>
                        )}
                    </nav>

                    <div className="flex min-w-0 items-center justify-end gap-2 lg:col-start-3">
                        {showDemoTrigger && <DemoTriggerButton />}
                        <ThemeToggle className="hidden sm:inline-flex" />

                        {/* Bell notification popover — only shown when connected */}
                        {connected && <Popover open={bellOpen} onOpenChange={setBellOpen}>
                            <PopoverTrigger asChild>
                                <button
                                    aria-label="Notifications"
                                    className={cn(
                                        "relative hidden sm:inline-flex h-9 w-9 items-center justify-center rounded-lg transition-colors",
                                        "text-muted-foreground hover:text-foreground hover:bg-secondary/70",
                                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                                        bellOpen && "bg-secondary/70 text-foreground"
                                    )}
                                >
                                    <Bell className="h-4 w-4" />
                                    {unread > 0 && (
                                        <span className="absolute right-1 top-1 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-primary px-0.5 font-mono text-[8px] font-bold leading-none text-primary-foreground">
                                            {unread > 9 ? "9+" : unread}
                                        </span>
                                    )}
                                </button>
                            </PopoverTrigger>
                            <PopoverContent
                                align="end"
                                sideOffset={8}
                                className="w-[360px] p-0 shadow-lg"
                            >
                                {/* Header */}
                                <div className="flex items-center justify-between border-b border-border/40 px-4 py-3">
                                    <div className="flex items-center gap-2">
                                        <span className="font-display text-[13px] font-semibold text-foreground">Notifications</span>
                                        {unread > 0 && (
                                            <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 font-mono text-[9px] font-bold text-primary-foreground">
                                                {unread}
                                            </span>
                                        )}
                                    </div>
                                    {unread > 0 && (
                                        <button
                                            onClick={markAllRead}
                                            className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground hover:text-foreground transition-colors"
                                        >
                                            <CheckCheck className="h-3 w-3" />
                                            Mark all read
                                        </button>
                                    )}
                                </div>

                                {/* Alert list */}
                                <div className="max-h-[400px] overflow-y-auto">
                                    {alerts.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
                                            <Bell className="h-6 w-6 text-muted-foreground/50" />
                                            <p className="text-[13px] text-muted-foreground">No notifications yet</p>
                                        </div>
                                    ) : (
                                        <div className="divide-y divide-border/40">
                                            {alerts.map((alert) => {
                                                const meta = KIND_META[alert.kind] ?? KIND_META.fee;
                                                const Icon = meta.icon;
                                                const ago = formatDistanceToNow(new Date(alert.time), { addSuffix: true });
                                                return (
                                                    <div
                                                        key={alert.id}
                                                        className={cn(
                                                            "relative flex gap-3 px-4 py-3 transition-colors hover:bg-secondary/30",
                                                            !alert.read && "bg-primary/[0.03]"
                                                        )}
                                                    >
                                                        {!alert.read && (
                                                            <div className="absolute left-0 inset-y-2 w-[2px] rounded-r-full bg-primary" />
                                                        )}
                                                        <div className={cn(
                                                            "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg",
                                                            !alert.read ? "bg-primary/10" : "bg-secondary/60"
                                                        )}>
                                                            <Icon className={cn("h-3.5 w-3.5", !alert.read ? meta.color : "text-muted-foreground")} />
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-start justify-between gap-2">
                                                                <span className={cn(
                                                                    "text-[12px] font-semibold leading-snug",
                                                                    alert.read ? "text-foreground/70" : "text-foreground"
                                                                )}>
                                                                    {alert.title}
                                                                </span>
                                                                <span className="shrink-0 font-mono text-[10px] text-muted-foreground">{ago}</span>
                                                            </div>
                                                            <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground line-clamp-2">
                                                                {alert.description}
                                                            </p>
                                                            <div className="mt-1.5 flex items-center gap-3">
                                                                {alert.vaultId && (
                                                                    <Link
                                                                        to={`/vault/${alert.vaultId}`}
                                                                        onClick={() => setBellOpen(false)}
                                                                        className="inline-flex items-center gap-1 font-mono text-[10px] text-primary/80 hover:text-primary transition-colors"
                                                                    >
                                                                        View vault <ExternalLink className="h-2.5 w-2.5" />
                                                                    </Link>
                                                                )}
                                                                {!alert.read && (
                                                                    <button
                                                                        onClick={() => markRead(alert.id)}
                                                                        className="inline-flex items-center gap-1 font-mono text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                                                                    >
                                                                        <Check className="h-2.5 w-2.5" /> Mark read
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            </PopoverContent>
                        </Popover>}

                        {!connected ? (
                            <Button
                                onClick={() => setConnectOpen(true)}
                                size="sm"
                                className="h-9 border-0 bg-primary text-primary-foreground shadow-signal hover:bg-primary-glow font-display font-semibold text-[13px]"
                            >
                                <Wallet className="w-3.5 h-3.5 mr-1.5" />
                                Connect Wallet
                            </Button>
                        ) : (
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="outline" size="sm" className="h-10 min-w-[8.5rem] justify-between gap-2 border-border/60 px-3 font-mono text-[12px]">
                                        <span className="flex min-w-0 items-center gap-2">
                                            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-status-active animate-pulse-glow" />
                                            <span className="truncate">{shortAddr(address!)}</span>
                                        </span>
                                        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-80 p-0">
                                    <div className="border-b border-border/40 px-4 py-3">
                                        <div className="flex items-center justify-between gap-3">
                                            <div className="min-w-0">
                                                <p className="font-display text-[13px] font-semibold text-foreground">
                                                    {walletName ?? "Wallet"}
                                                </p>
                                                <p className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground">
                                                    {address}
                                                </p>
                                            </div>
                                            <span className="inline-flex h-7 shrink-0 items-center rounded-md bg-primary/10 px-2 font-mono text-[10px] uppercase tracking-[0.12em] text-primary">
                                                {role}
                                            </span>
                                        </div>
                                        <div className="mt-3 grid grid-cols-3 gap-2 text-[11px]">
                                            <div className="rounded-lg bg-secondary/55 px-2 py-2">
                                                <span className="block text-muted-foreground">Network</span>
                                                <span className="mt-1 flex items-center gap-1.5 font-mono capitalize text-foreground">
                                                    <Globe2 className="h-3 w-3 text-primary/70" />
                                                    {network}
                                                </span>
                                            </div>
                                            <div className="rounded-lg bg-secondary/55 px-2 py-2">
                                                <span className="block text-muted-foreground">Mode</span>
                                                <span className="mt-1 flex items-center gap-1.5 font-mono capitalize text-foreground">
                                                    <LayoutDashboard className="h-3 w-3 text-primary/70" />
                                                    {role}
                                                </span>
                                            </div>
                                            <div className="rounded-lg bg-secondary/55 px-2 py-2">
                                                <span className="block text-muted-foreground">Data</span>
                                                <span className="mt-1 flex items-center gap-1.5 font-mono text-foreground">
                                                    <span className={cn("h-1.5 w-1.5 rounded-full", status === "live" ? "bg-primary" : "bg-warning")} />
                                                    {realtimeLabel}
                                                </span>
                                            </div>
                                        </div>
                                        {lastEventAt && (
                                            <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground/70">
                                                Last update {new Date(lastEventAt).toLocaleTimeString()}
                                            </p>
                                        )}
                                    </div>
                                    {publicKey && (
                                        <div className="border-b border-border/40 px-4 py-3">
                                            <DevnetUsdcFaucet compact />
                                        </div>
                                    )}
                                    <div className="p-1.5">
                                        <DropdownMenuLabel className="px-2 py-1.5 text-[11px] font-mono uppercase tracking-[0.14em] text-muted-foreground">
                                            Account
                                        </DropdownMenuLabel>
                                        <DropdownMenuItem onClick={() => switchRole("investor")}>Switch to Investor</DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => switchRole("trader")}>Switch to Trader</DropdownMenuItem>
                                    </div>
                                    <DropdownMenuSeparator />
                                    <div className="p-1.5">
                                        <DropdownMenuItem asChild>
                                            <Link to="/portfolio">Portfolio</Link>
                                        </DropdownMenuItem>
                                        <DropdownMenuItem asChild>
                                            <Link to="/vaults">Marketplace</Link>
                                        </DropdownMenuItem>
                                    </div>
                                    <DropdownMenuSeparator />
                                    <div className="p-1.5">
                                        <DropdownMenuItem onClick={disconnect} className="text-destructive focus:text-destructive">
                                            <LogOut className="mr-2 h-4 w-4" />
                                            Disconnect
                                        </DropdownMenuItem>
                                    </div>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        )}

                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 rounded-lg lg:hidden"
                            onClick={() => setOpen((v) => !v)}
                            aria-label={open ? "Close menu" : "Open menu"}
                        >
                            {open ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
                        </Button>
                    </div>
                </div>
            </header>

            {open && (
                <div className="border-b border-border/40 bg-background/95 backdrop-blur-xl lg:hidden">
                    <div className="container py-3 flex flex-col gap-1">
                        {showDemoTrigger && (
                            <button
                                onClick={() => {
                                    setOpen(false);
                                    window.dispatchEvent(new CustomEvent("kiln:demo-start"));
                                }}
                                className="rounded-lg border border-primary/25 bg-primary/5 px-3 py-2 text-left font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-primary hover:bg-primary/10"
                            >
                                Start auto demo
                            </button>
                        )}
                        {[...links, ...secondaryLinks].map((l) =>
                            "to" in l ? (
                                <Link
                                    key={l.to}
                                    to={l.to}
                                    onClick={() => setOpen(false)}
                                    className="rounded-lg px-3 py-2 text-[13px] text-muted-foreground hover:bg-secondary/70 hover:text-foreground"
                                >
                                    {l.label}
                                </Link>
                            ) : (
                                <button
                                    key={l.label}
                                    onClick={() => {
                                        setOpen(false);
                                        l.action();
                                    }}
                                    className="rounded-lg px-3 py-2 text-left text-[13px] text-muted-foreground hover:bg-secondary/70 hover:text-foreground"
                                >
                                    {l.label}
                                </button>
                            )
                        )}
                    </div>
                </div>
            )}
            <ConnectModal open={connectOpen} onOpenChange={setConnectOpen} />
        </>
    );
};
