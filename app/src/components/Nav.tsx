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
    const { setVisible: openWalletModal } = useWalletModal();
    const location = useLocation();

    const publicLinks = [
        { to: "/vaults", label: "Marketplace" },
        { to: "/traders", label: "Traders" },
        { to: "/docs", label: "Docs" },
    ];

    const investorLinks = [
        { to: "/vaults", label: "Marketplace" },
        { to: "/portfolio", label: "Portfolio" },
        { to: "/alerts", label: "Activity" },
        { to: "/settings", label: "Settings" },
    ];

    const traderLinks = [
        { to: "/manager", label: "Manager" },
        { to: "/trade", label: "Trade" },
        { to: "/manager/create", label: "Vault config" },
        { to: "/traders", label: "Investors" },
        { to: "/alerts", label: "Alerts" },
    ];

    const links = !connected
        ? publicLinks
        : role === "trader"
          ? traderLinks
          : investorLinks;

    return (
        <>
            <header className="sticky top-0 z-40 border-b border-border/35 bg-background/78 backdrop-blur-xl shadow-[0_1px_0_hsl(var(--foreground)/0.035)]">
                <div className="container flex items-center justify-between h-16">
                    <div className="flex items-center gap-8">
                        <Link to="/" className="flex items-center gap-2.5 group">
                            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary shadow-signal ring-1 ring-primary/25">
                                <ArcadiaLogo className="h-6 w-6" />
                            </div>
                            <span className="font-display font-bold text-lg tracking-tight">
                                Arcadia
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
                                            "relative px-3 py-2 text-sm font-medium transition-[color] after:absolute after:inset-x-3 after:bottom-1 after:h-px after:origin-center after:scale-x-0 after:bg-primary after:shadow-[0_0_18px_hsl(var(--primary)/0.65)] after:transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                                            active
                                                ? "text-foreground after:scale-x-100"
                                                : "text-muted-foreground hover:text-foreground",
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
                            <div className="hidden lg:flex items-center gap-2 rounded-full bg-card/50 px-3 py-1.5 text-xs shadow-card ring-1 ring-border/35">
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
                                className="relative hidden min-h-10 min-w-10 items-center justify-center rounded-md text-muted-foreground transition-[background-color,color] hover:bg-primary/10 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:inline-flex"
                            >
                                <Bell className="w-4 h-4" />
                                <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-primary" />
                            </Link>
                        )}
                        {!connected ? (
                            <Button
                                onClick={() => openWalletModal(true)}
                                className="border-0 bg-primary text-primary-foreground hover:bg-primary-glow"
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
                                        <div className="flex items-center gap-2 text-xs font-normal text-muted-foreground">
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
                            className="md:hidden p-2 rounded-md hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
                    <nav className="md:hidden border-t border-border/35 bg-background/95 backdrop-blur-xl">
                        <div className="container py-3 flex flex-col gap-1">
                            {connected && (
                                <div className="mb-2 grid grid-cols-2 gap-2 rounded-lg bg-card/55 p-2 text-xs shadow-card ring-1 ring-border/35">
                                    <div>
                                        <div className="text-xs uppercase tracking-wider text-muted-foreground">
                                            Network
                                        </div>
                                        <div className="mt-0.5 flex items-center gap-1.5 capitalize text-foreground">
                                            <Globe2 className="w-3.5 h-3.5 text-primary" />
                                            {network}
                                        </div>
                                    </div>
                                    <div>
                                        <div className="text-xs uppercase tracking-wider text-muted-foreground">
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
                                                ? "bg-primary/10 text-foreground"
                                                : "text-muted-foreground hover:bg-primary/10 hover:text-foreground",
                                        )}
                                    >
                                        {l.label}
                                    </Link>
                                );
                            })}
                            {!links.some((link) => link.to === "/settings") && (
                                <Link
                                    to="/settings"
                                    onClick={() => setOpen(false)}
                                    className={cn(
                                        "px-3 py-2 rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                                        location.pathname === "/settings"
                                            ? "bg-primary/10 text-foreground"
                                            : "text-muted-foreground hover:bg-primary/10 hover:text-foreground",
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
