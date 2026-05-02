import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useWallet, shortAddr } from "@/lib/wallet";
import { Button } from "@/components/ui/button";
import {
    Wallet,
    Bell,
    Menu,
    X,
    ChevronDown,
    LogOut,
    ArrowLeftRight,
    Globe2,
    ShieldCheck,
    LayoutDashboard,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
    DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { ArcadiaLogo } from "@/components/ArcadiaLogo";

export const Nav = () => {
    const { connected, address, role, network, walletName, setRole, disconnect } = useWallet();
    const [open, setOpen] = useState(false);
    const { setVisible: openWalletModal } = useWalletModal();
    const location = useLocation();

    const publicLinks = [
        { to: "/vaults", label: "Marketplace" },
        { to: "/traders", label: "Traders" },
        { to: "/how-it-works", label: "How it works" },
        { to: "/docs", label: "Docs" },
    ];

    const investorLinks = [
        { to: "/vaults", label: "Marketplace" },
        { to: "/portfolio", label: "Portfolio" },
        { to: "/traders", label: "Traders" },
        { to: "/alerts", label: "Activity" },
    ];

    const traderLinks = [
        { to: "/manager", label: "Dashboard" },
        { to: "/trade", label: "Trade" },
        { to: "/manager/create", label: "New vault" },
        { to: "/traders", label: "Directory" },
        { to: "/alerts", label: "Alerts" },
    ];

    const links = !connected ? publicLinks : role === "trader" ? traderLinks : investorLinks;

    const isActive = (to: string) =>
        location.pathname === to || (to !== "/" && location.pathname.startsWith(to));

    return (
        <>
            <header className="sticky top-0 z-40 border-b border-border/30 bg-background/80 backdrop-blur-xl">
                <div className="container flex items-center justify-between h-[3.75rem]">
                    <div className="flex items-center gap-7">
                        <Link to="/" className="flex items-center gap-2 group shrink-0">
                            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20 shadow-signal">
                                <ArcadiaLogo className="h-[18px] w-[18px]" />
                            </div>
                            <span className="font-display font-semibold text-[15px] tracking-tight text-foreground">
                                Arcadia
                            </span>
                        </Link>

                        <nav className="hidden md:flex items-center gap-0.5">
                            {links.map((l) => (
                                <Link
                                    key={l.to}
                                    to={l.to}
                                    className={cn(
                                        "relative px-3 py-2 text-[13px] font-medium rounded-md transition-colors",
                                        "after:absolute after:inset-x-2.5 after:bottom-0.5 after:h-px after:origin-center",
                                        "after:scale-x-0 after:rounded-full after:bg-primary after:transition-transform",
                                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                                        isActive(l.to)
                                            ? "text-foreground after:scale-x-100"
                                            : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
                                    )}
                                >
                                    {l.label}
                                </Link>
                            ))}
                        </nav>
                    </div>

                    <div className="flex items-center gap-1.5">
                        {connected && (
                            <div className="hidden lg:flex items-center gap-2 rounded-full border border-border/50 bg-card/60 px-3 py-1.5 text-[11px]">
                                <span className="flex items-center gap-1.5 text-muted-foreground">
                                    <Globe2 className="w-3 h-3 text-primary/70" />
                                    <span className="capitalize font-mono">{network}</span>
                                </span>
                                <span className="h-3 w-px bg-border" />
                                <span className="flex items-center gap-1.5">
                                    <LayoutDashboard className="w-3 h-3 text-primary/70" />
                                    <span className="capitalize font-mono text-foreground/80">{role}</span>
                                </span>
                            </div>
                        )}

                        {connected && (
                            <Link
                                to="/alerts"
                                aria-label="Notifications"
                                className="relative hidden sm:inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary/60 hover:text-foreground transition-colors"
                            >
                                <Bell className="w-3.5 h-3.5" />
                                <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-primary animate-pulse-glow" />
                            </Link>
                        )}

                        {!connected ? (
                            <Button
                                onClick={() => openWalletModal(true)}
                                size="sm"
                                className="h-9 border-0 bg-primary text-primary-foreground hover:bg-primary-glow font-display font-semibold text-[13px]"
                            >
                                <Wallet className="w-3.5 h-3.5 mr-1.5" />
                                Connect Wallet
                            </Button>
                        ) : (
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="outline" size="sm" className="h-9 font-mono text-[12px] border-border/60">
                                        <span className="w-1.5 h-1.5 rounded-full bg-status-active mr-1.5 animate-pulse-glow" />
                                        {shortAddr(address)}
                                        <ChevronDown className="w-3 h-3 ml-1.5 text-muted-foreground" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-56">
                                    <DropdownMenuLabel className="space-y-1">
                                        <div className="font-mono text-[11px] text-foreground">
                                            {address?.slice(0, 18)}…
                                        </div>
                                        <div className="flex items-center gap-2 text-[11px] font-normal text-muted-foreground">
                                            <span>{walletName ?? "Demo wallet"}</span>
                                            <span>·</span>
                                            <span className="capitalize">{network}</span>
                                        </div>
                                    </DropdownMenuLabel>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuLabel className="text-[11px] text-muted-foreground">Switch role</DropdownMenuLabel>
                                    <DropdownMenuItem
                                        onClick={() => setRole("investor")}
                                        className={cn("text-sm", role === "investor" && "bg-secondary")}
                                    >
                                        <ArrowLeftRight className="w-3.5 h-3.5 mr-2" /> Investor
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                        onClick={() => setRole("trader")}
                                        className={cn("text-sm", role === "trader" && "bg-secondary")}
                                    >
                                        <ArrowLeftRight className="w-3.5 h-3.5 mr-2" /> Trader
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem asChild className="text-sm">
                                        <Link to="/settings">
                                            <ShieldCheck className="w-3.5 h-3.5 mr-2" /> Settings
                                        </Link>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={disconnect} className="text-sm text-destructive">
                                        <LogOut className="w-3.5 h-3.5 mr-2" /> Disconnect
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        )}

                        <button
                            onClick={() => setOpen(!open)}
                            aria-label={open ? "Close menu" : "Open menu"}
                            aria-expanded={open}
                            className="md:hidden h-9 w-9 inline-flex items-center justify-center rounded-lg hover:bg-secondary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                            {open ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
                        </button>
                    </div>
                </div>

                {open && (
                    <nav className="md:hidden border-t border-border/30 bg-background/95 backdrop-blur-xl">
                        <div className="container py-3 flex flex-col gap-1">
                            {connected && (
                                <div className="mb-2 grid grid-cols-2 gap-2 rounded-lg bg-card/60 border border-border/40 p-2.5 text-[11px]">
                                    <div>
                                        <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">Network</div>
                                        <div className="flex items-center gap-1.5 capitalize text-foreground font-mono">
                                            <Globe2 className="w-3 h-3 text-primary/70" />{network}
                                        </div>
                                    </div>
                                    <div>
                                        <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">Role</div>
                                        <div className="flex items-center gap-1.5 capitalize text-foreground font-mono">
                                            <ShieldCheck className="w-3 h-3 text-success/70" />{role}
                                        </div>
                                    </div>
                                </div>
                            )}
                            {links.map((l) => (
                                <Link
                                    key={l.to}
                                    to={l.to}
                                    onClick={() => setOpen(false)}
                                    className={cn(
                                        "px-3 py-2 rounded-lg text-[13px] font-medium transition-colors",
                                        isActive(l.to)
                                            ? "bg-primary/10 text-foreground"
                                            : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
                                    )}
                                >
                                    {l.label}
                                </Link>
                            ))}
                            {!links.some((l) => l.to === "/settings") && (
                                <Link
                                    to="/settings"
                                    onClick={() => setOpen(false)}
                                    className={cn(
                                        "px-3 py-2 rounded-lg text-[13px] font-medium transition-colors",
                                        location.pathname === "/settings"
                                            ? "bg-primary/10 text-foreground"
                                            : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
                                    )}
                                >
                                    Settings
                                </Link>
                            )}
                        </div>
                    </nav>
                )}
            </header>
        </>
    );
};
