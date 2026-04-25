import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useWallet, shortAddr } from "@/lib/wallet";
import { Button } from "@/components/ui/button";
import {
    Wallet,
    Bell,
    Menu,
    X,
    Flame,
    ChevronDown,
    LogOut,
    ArrowLeftRight,
    Globe2,
    ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ConnectModal } from "./ConnectModal";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
    DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";

export const Nav = () => {
    const {
        connected,
        address,
        role,
        network,
        walletName,
        setRole,
        disconnect,
    } = useWallet();
    const [open, setOpen] = useState(false);
    const [connectOpen, setConnectOpen] = useState(false);
    const location = useLocation();

    const publicLinks = [
        { to: "/vaults", label: "Vaults" },
        { to: "/traders", label: "Traders" },
        { to: "/trade", label: "Trade" },
        { to: "/how-it-works", label: "How it works" },
        { to: "/docs", label: "Docs" },
    ];

    const investorLinks = [
        { to: "/vaults", label: "Vaults" },
        { to: "/traders", label: "Traders" },
        { to: "/trade", label: "Trade" },
        { to: "/portfolio", label: "Portfolio" },
        { to: "/alerts", label: "Alerts" },
    ];

    const traderLinks = [
        { to: "/trade", label: "Trade" },
        { to: "/manager", label: "Manager" },
        { to: "/vaults", label: "Vaults" },
        { to: "/traders", label: "Traders" },
        { to: "/alerts", label: "Alerts" },
    ];

    const links = !connected
        ? publicLinks
        : role === "trader"
          ? traderLinks
          : investorLinks;

    return (
        <>
            <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-xl">
                <div className="container flex items-center justify-between h-16">
                    <div className="flex items-center gap-8">
                        <Link to="/" className="flex items-center gap-2 group">
                            <div className="w-8 h-8 rounded-lg bg-gradient-ember flex items-center justify-center shadow-ember">
                                <Flame className="w-4 h-4 text-white" />
                            </div>
                            <span className="font-display font-bold text-lg tracking-tight">
                                Kiln
                            </span>
                        </Link>
                        <nav className="hidden md:flex items-center gap-1">
                            {links.map((l) => {
                                const active =
                                    location.pathname === l.to ||
                                    (l.to !== "/" &&
                                        location.pathname.startsWith(l.to));
                                return (
                                    <Link
                                        key={l.to}
                                        to={l.to}
                                        className={cn(
                                            "px-3 py-1.5 rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                                            active
                                                ? "text-foreground bg-secondary"
                                                : "text-muted-foreground hover:text-foreground hover:bg-secondary/60",
                                        )}
                                    >
                                        {l.label}
                                    </Link>
                                );
                            })}
                        </nav>
                    </div>

                    <div className="flex items-center gap-2">
                        {connected && (
                            <div className="hidden lg:flex items-center gap-2 rounded-full border border-border bg-card/70 px-3 py-1.5 text-xs shadow-card">
                                <span className="inline-flex items-center gap-1.5 capitalize text-muted-foreground">
                                    <Globe2 className="w-3.5 h-3.5 text-primary" />
                                    {network}
                                </span>
                                <span className="h-3 w-px bg-border" />
                                <span className="inline-flex items-center gap-1.5 capitalize text-foreground">
                                    <ShieldCheck className="w-3.5 h-3.5 text-success" />
                                    {role}
                                </span>
                            </div>
                        )}
                        {connected && (
                            <Link
                                to="/alerts"
                                aria-label="Notifications"
                                className="hidden sm:inline-flex p-2 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                            >
                                <Bell className="w-4 h-4" />
                                <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-primary" />
                            </Link>
                        )}
                        {!connected ? (
                            <Button
                                onClick={() => setConnectOpen(true)}
                                className="bg-gradient-ember hover:opacity-90 text-white border-0"
                            >
                                <Wallet className="w-4 h-4 mr-2" />
                                Connect Wallet
                            </Button>
                        ) : (
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="font-mono"
                                    >
                                        <span className="w-2 h-2 rounded-full bg-status-active mr-2" />
                                        {shortAddr(address)}
                                        <ChevronDown className="w-3 h-3 ml-1.5" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent
                                    align="end"
                                    className="w-56"
                                >
                                    <DropdownMenuLabel className="space-y-1">
                                        <div className="font-mono text-xs">
                                            {address?.slice(0, 16)}...
                                        </div>
                                        <div className="flex items-center gap-2 text-[11px] font-normal text-muted-foreground">
                                            <span>
                                                {walletName ?? "Demo wallet"}
                                            </span>
                                            <span>·</span>
                                            <span className="capitalize">
                                                {network}
                                            </span>
                                        </div>
                                    </DropdownMenuLabel>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuLabel className="text-xs text-muted-foreground">
                                        Active role
                                    </DropdownMenuLabel>
                                    <DropdownMenuItem
                                        onClick={() => setRole("investor")}
                                        className={cn(
                                            role === "investor" &&
                                                "bg-secondary",
                                        )}
                                    >
                                        <ArrowLeftRight className="w-4 h-4 mr-2" />{" "}
                                        Investor
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                        onClick={() => setRole("trader")}
                                        className={cn(
                                            role === "trader" && "bg-secondary",
                                        )}
                                    >
                                        <ArrowLeftRight className="w-4 h-4 mr-2" />{" "}
                                        Trader
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem asChild>
                                        <Link to="/settings">Settings</Link>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                        onClick={disconnect}
                                        className="text-destructive"
                                    >
                                        <LogOut className="w-4 h-4 mr-2" />{" "}
                                        Disconnect
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        )}
                        <button
                            onClick={() => setOpen(!open)}
                            aria-label={
                                open
                                    ? "Close navigation menu"
                                    : "Open navigation menu"
                            }
                            aria-expanded={open}
                            className="md:hidden p-2 rounded-md hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                            {open ? (
                                <X className="w-4 h-4" />
                            ) : (
                                <Menu className="w-4 h-4" />
                            )}
                        </button>
                    </div>
                </div>

                {open && (
                    <nav className="md:hidden border-t border-border bg-background">
                        <div className="container py-3 flex flex-col gap-1">
                            {connected && (
                                <div className="mb-2 grid grid-cols-2 gap-2 rounded-xl border border-border bg-card/60 p-2 text-xs">
                                    <div>
                                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                                            Network
                                        </div>
                                        <div className="mt-0.5 flex items-center gap-1.5 capitalize text-foreground">
                                            <Globe2 className="w-3.5 h-3.5 text-primary" />
                                            {network}
                                        </div>
                                    </div>
                                    <div>
                                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                                            Role
                                        </div>
                                        <div className="mt-0.5 flex items-center gap-1.5 capitalize text-foreground">
                                            <ShieldCheck className="w-3.5 h-3.5 text-success" />
                                            {role}
                                        </div>
                                    </div>
                                </div>
                            )}
                            {links.map((l) => {
                                const active =
                                    location.pathname === l.to ||
                                    (l.to !== "/" &&
                                        location.pathname.startsWith(l.to));
                                return (
                                    <Link
                                        key={l.to}
                                        to={l.to}
                                        onClick={() => setOpen(false)}
                                        className={cn(
                                            "px-3 py-2 rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                                            active
                                                ? "bg-secondary text-foreground"
                                                : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                                        )}
                                    >
                                        {l.label}
                                    </Link>
                                );
                            })}
                            <Link
                                to="/settings"
                                onClick={() => setOpen(false)}
                                className={cn(
                                    "px-3 py-2 rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                                    location.pathname === "/settings"
                                        ? "bg-secondary text-foreground"
                                        : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                                )}
                            >
                                Settings
                            </Link>
                        </div>
                    </nav>
                )}
            </header>
            <ConnectModal open={connectOpen} onOpenChange={setConnectOpen} />
        </>
    );
};
