import {
    useEffect,
    useRef,
    useState,
    type ButtonHTMLAttributes,
    type ReactNode,
} from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import { useWallet, type Role, shortAddr } from "@/lib/wallet";
import {
    Wallet,
    Shield,
    TrendingUp,
    Layers,
    ArrowRight,
    Check,
    Loader2,
    AlertCircle,
    Globe,
    Copy,
    ExternalLink,
    X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

type Step = "role" | "wallet" | "connecting" | "success" | "error";

const WALLETS = [
    {
        name: "Phantom",
        tone: "bg-primary/12 text-primary ring-1 ring-primary/25",
        recommended: true,
        demo: false,
    },
    {
        name: "Solflare",
        tone: "bg-warning/12 text-warning ring-1 ring-warning/25",
        recommended: false,
        demo: false,
    },
];

function detectWallet(name: string): boolean {
    if (typeof window === "undefined") return false;
    const w = window as Record<string, unknown>;
    if (name === "Phantom")
        return Boolean(
            (w.phantom as Record<string, unknown> | undefined)?.solana,
        );
    if (name === "Solflare") return Boolean(w.solflare);
    return true; // Demo Wallet always available
}

export const ConnectModal = ({
    open,
    onOpenChange,
}: {
    open: boolean;
    onOpenChange: (o: boolean) => void;
}) => {
    const {
        connect,
        setRole,
        role,
        address,
        connected,
        disconnect,
        walletName,
        setNetwork,
    } = useWallet();
    const navigate = useNavigate();

    const [step, setStep] = useState<Step>(connected ? "success" : "role");
    const [chosenRole, setChosenRole] = useState<Role | null>(null);
    const [chosenWallet, setChosenWallet] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const routeTimerRef = useRef<number | null>(null);

    // Sync to current connection state when opened
    useEffect(() => {
        if (open) {
            if (connected) {
                setStep("success");
                // Pre-fill chosenRole from the persisted wallet role so the
                // success panel can route correctly on reopen.
                setChosenRole(role);
            } else {
                setStep("role");
                setChosenRole(null);
                setChosenWallet(null);
                setError(null);
            }
        }
    }, [open, connected, role]);

    useEffect(() => {
        return () => {
            if (routeTimerRef.current !== null) {
                window.clearTimeout(routeTimerRef.current);
            }
        };
    }, []);

    const reset = () => {
        if (routeTimerRef.current !== null) {
            window.clearTimeout(routeTimerRef.current);
            routeTimerRef.current = null;
        }
        setStep("role");
        setChosenRole(null);
        setChosenWallet(null);
        setError(null);
    };

    // Watch for real wallet connection completing (Phantom / Solflare popup approved)
    useEffect(() => {
        if (step === "connecting" && chosenWallet && chosenWallet !== "Demo Wallet" && connected) {
            if (chosenRole) setRole(chosenRole);
            setStep("success");
            toast.success(`Connected with ${chosenWallet}`, {
                description: "Devnet · live wallet",
            });
        }
    }, [connected, step, chosenWallet]); // eslint-disable-line react-hooks/exhaustive-deps

    const handleConnect = async (name: string) => {
        setChosenWallet(name);
        setStep("connecting");
        setError(null);
        try {
            setNetwork("devnet");
            await connect(name);
            if (chosenRole) setRole(chosenRole);
            setStep("success");
            toast.success(`Connected with ${name}`, {
                description: `${chosenRole === "trader" ? "Trader" : "Investor"} mode · Devnet`,
            });
        } catch (e) {
            setError(e instanceof Error ? e.message : "Connection failed");
            setStep("error");
        }
    };

    const handleCopy = () => {
        if (!address) return;
        navigator.clipboard.writeText(address);
        toast.success("Address copied");
    };

    const handleDisconnect = () => {
        disconnect();
        onOpenChange(false);
        reset();
        toast("Wallet disconnected");
    };

    return (
        <Dialog
            open={open}
            onOpenChange={(o) => {
                onOpenChange(o);
                if (!o) setTimeout(reset, 200);
            }}
        >
            <DialogContent className="surface-elevated border-border-strong sm:max-w-lg p-0 overflow-hidden">
                {/* Step indicator */}
                {(step === "role" ||
                    step === "wallet") && <StepBar current={step} />}

                <div className="p-6">
                    <AnimatePresence mode="wait">
                        {step === "role" && (
                            <motion.div key="role" {...fade}>
                                <DialogHeader>
                                    <DialogTitle className="font-display text-2xl">
                                        How will you use Arcadia?
                                    </DialogTitle>
                                    <DialogDescription>
                                        Pick the experience that fits you. You
                                        can switch roles anytime from your
                                        wallet menu.
                                    </DialogDescription>
                                </DialogHeader>
                                <div className="grid sm:grid-cols-2 gap-3 mt-4">
                                    <RoleCard
                                        icon={Layers}
                                        title="Investor"
                                        desc="Discover graduated traders, deposit into vaults, and monitor risk in real time."
                                        bullets={[
                                            "Browse vetted vaults",
                                            "First-loss protection",
                                            "Instant exits when buffers thin",
                                        ]}
                                        selected={chosenRole === "investor"}
                                        onClick={() =>
                                            setChosenRole("investor")
                                        }
                                    />
                                    <RoleCard
                                        icon={TrendingUp}
                                        title="Trader"
                                        desc="Create a vault, fund junior capital, and build an on-chain track record investors trust."
                                        bullets={[
                                            "Pro trading terminal",
                                            "Earn fees above HWM",
                                            "Build reputation tier",
                                        ]}
                                        selected={chosenRole === "trader"}
                                        onClick={() => setChosenRole("trader")}
                                    />
                                </div>
                                <PrimaryButton
                                    className="mt-5"
                                    disabled={!chosenRole}
                                    onClick={() => setStep("wallet")}
                                >
                                    Continue <ArrowRight className="w-4 h-4" />
                                </PrimaryButton>
                            </motion.div>
                        )}

                        {step === "wallet" && (
                            <motion.div key="wallet" {...fade}>
                                <DialogHeader>
                                    <DialogTitle className="font-display text-2xl">
                                        Connect on devnet
                                    </DialogTitle>
                                    <DialogDescription className="flex items-center gap-2 flex-wrap">
                                        Continuing as <Pill>{chosenRole}</Pill>{" "}
                                        on <Pill icon={Globe}>devnet</Pill>.
                                        Your wallet signs real Arcadia devnet
                                        transactions.
                                    </DialogDescription>
                                </DialogHeader>
                                <div className="space-y-2 mt-4">
                                    {WALLETS.map((w) => {
                                        const detected = detectWallet(w.name);
                                        return (
                                            <button
                                                key={w.name}
                                                onClick={() =>
                                                    handleConnect(w.name)
                                                }
                                                className="w-full flex items-center gap-3 p-3 rounded-lg border border-border hover:border-primary/50 hover:bg-primary/5 transition-colors text-left group"
                                            >
                                                <div
                                                    className={`w-10 h-10 rounded-lg ${w.tone} flex items-center justify-center shrink-0`}
                                                >
                                                    <Wallet className="w-5 h-5" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="font-medium flex items-center gap-2">
                                                        {w.name}
                                                        {w.recommended && (
                                                            <span className="text-xs uppercase tracking-wider px-1.5 py-0.5 rounded bg-primary/15 text-primary">
                                                                Recommended
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                                                        <span
                                                            className={`w-1.5 h-1.5 rounded-full ${detected ? "bg-success" : "bg-muted-foreground/40"}`}
                                                        />
                                                        {detected
                                                            ? "Extension detected"
                                                            : "Not installed — get it at " + (w.name === "Phantom" ? "phantom.app" : "solflare.com")}
                                                    </div>
                                                </div>
                                                <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-[color,transform]" />
                                            </button>
                                        );
                                    })}
                                </div>
                                <div className="flex gap-2 mt-5">
                                    <SecondaryButton
                                        onClick={() => setStep("role")}
                                    >
                                        Back
                                    </SecondaryButton>
                                </div>
                                <InfoNote>
                                    Arcadia never custodies funds. Devnet vault
                                    actions are signed by your wallet; Jupiter
                                    exposure previews are simulated with
                                    Surfpool where shown.
                                </InfoNote>
                            </motion.div>
                        )}

                        {step === "connecting" && (
                            <motion.div
                                key="connecting"
                                {...fade}
                                className="py-8 text-center"
                            >
                                <div className="relative w-16 h-16 mx-auto mb-5">
                                    <div className="absolute inset-0 rounded-full bg-primary/20 animate-pulse-glow" />
                                    <div className="absolute inset-2 rounded-full bg-gradient-signal flex items-center justify-center">
                                        <Loader2 className="w-7 h-7 text-primary-foreground animate-spin" />
                                    </div>
                                </div>
                                <DialogTitle className="font-display text-xl">
                                    Connecting to {chosenWallet}
                                </DialogTitle>
                                <DialogDescription className="mt-2">
                                    Approve the request in {chosenWallet} to
                                    continue on Arcadia devnet.
                                </DialogDescription>
                                <div className="mt-5 flex items-center justify-center gap-2 text-xs text-muted-foreground">
                                    <Globe className="w-3 h-3" /> devnet ·{" "}
                                    {chosenRole}
                                </div>
                                {chosenWallet !== "Demo Wallet" && (
                                    <div className="mt-4 flex justify-center">
                                        <SecondaryButton
                                            onClick={() => setStep("wallet")}
                                        >
                                            Cancel
                                        </SecondaryButton>
                                    </div>
                                )}
                            </motion.div>
                        )}

                        {step === "error" && (
                            <motion.div
                                key="error"
                                {...fade}
                                className="py-6 text-center"
                            >
                                <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-destructive/15 flex items-center justify-center">
                                    <AlertCircle className="w-7 h-7 text-destructive" />
                                </div>
                                <DialogTitle className="font-display text-xl">
                                    Connection failed
                                </DialogTitle>
                                <DialogDescription className="mt-2">
                                    {error ??
                                        "Something went wrong while connecting your wallet."}
                                </DialogDescription>
                                <div className="flex gap-2 mt-5">
                                    <SecondaryButton
                                        onClick={() => setStep("wallet")}
                                    >
                                        Choose another
                                    </SecondaryButton>
                                    <PrimaryButton
                                        onClick={() =>
                                            chosenWallet &&
                                            handleConnect(chosenWallet)
                                        }
                                    >
                                        Retry <ArrowRight className="w-4 h-4" />
                                    </PrimaryButton>
                                </div>
                            </motion.div>
                        )}

                        {step === "success" && (
                            <motion.div
                                key="success"
                                {...fade}
                                className="py-2"
                            >
                                <div className="text-center">
                                    <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-success/15 flex items-center justify-center">
                                        <Check className="w-7 h-7 text-success" />
                                    </div>
                                    <DialogTitle className="font-display text-xl">
                                        Wallet connected
                                    </DialogTitle>
                                    <DialogDescription className="mt-1">
                                        You're signed in
                                        {walletName
                                            ? ` with ${walletName}`
                                            : ""}{" "}
                                        on Arcadia devnet.
                                    </DialogDescription>
                                </div>

                                <div className="mt-5 surface rounded-lg p-4 space-y-3">
                                    <Detail label="Address">
                                        <div className="flex items-center gap-1.5 font-mono text-sm">
                                            {shortAddr(address)}
                                            <button
                                                onClick={handleCopy}
                                                className="text-muted-foreground hover:text-foreground p-1 -m-1"
                                            >
                                                <Copy className="w-3.5 h-3.5" />
                                            </button>
                                            <a
                                                href={`https://solscan.io/account/${address}?cluster=devnet`}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="text-muted-foreground hover:text-foreground p-1 -m-1"
                                            >
                                                <ExternalLink className="w-3.5 h-3.5" />
                                            </a>
                                        </div>
                                    </Detail>
                                    <Detail label="Network">
                                        <span className="inline-flex items-center gap-1.5 text-sm">
                                            <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse-glow" />
                                            devnet
                                        </span>
                                    </Detail>
                                    <Detail label="Role">
                                        <div className="flex items-center gap-1 p-0.5 rounded-md bg-secondary">
                                            {(
                                                ["investor", "trader"] as Role[]
                                            ).map((r) => {
                                                const active =
                                                    (chosenRole ?? role) === r;
                                                return (
                                                    <button
                                                        key={r}
                                                        onClick={() => {
                                                            setChosenRole(r);
                                                            setRole(r);
                                                        }}
                                                        className={cn(
                                                            "px-2.5 py-0.5 rounded text-xs capitalize transition-colors",
                                                            active
                                                                ? "bg-background text-foreground shadow-sm"
                                                                : "text-muted-foreground hover:text-foreground",
                                                        )}
                                                    >
                                                        {r}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </Detail>
                                </div>

                                <div className="flex gap-2 mt-5">
                                    <SecondaryButton onClick={handleDisconnect}>
                                        <X className="w-4 h-4" /> Disconnect
                                    </SecondaryButton>
                                    <PrimaryButton
                                        onClick={() => {
                                            const target =
                                                (chosenRole ?? role) ===
                                                "trader"
                                                    ? "/manager"
                                                    : "/portfolio";
                                            onOpenChange(false);
                                            routeTimerRef.current =
                                                window.setTimeout(() => {
                                                    navigate(target);
                                                    reset();
                                                }, 120);
                                        }}
                                    >
                                        Go to dashboard{" "}
                                        <ArrowRight className="w-4 h-4" />
                                    </PrimaryButton>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </DialogContent>
        </Dialog>
    );
};

/* ---------- helpers ---------- */

const fade = {
    initial: { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -6 },
    transition: { duration: 0.18 },
};

const StepBar = ({ current }: { current: Step }) => {
    const steps: Step[] = ["role", "wallet"];
    const idx = steps.indexOf(current);
    return (
        <div className="flex items-center gap-2 px-6 pt-5">
            {steps.map((s, i) => (
                <div
                    key={s}
                    className="flex-1 h-1 rounded-full bg-secondary overflow-hidden"
                >
                    <div
                        className={cn(
                            "h-full transition-[width] duration-500",
                            i <= idx ? "bg-gradient-signal w-full" : "w-0",
                        )}
                    />
                </div>
            ))}
        </div>
    );
};

const PrimaryButton = ({
    children,
    className,
    ...rest
}: ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button
        {...rest}
        className={cn(
            "flex-1 inline-flex items-center justify-center gap-2 h-11 rounded-lg bg-gradient-signal text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed text-left font-medium ml-[0px] pl-[5px] pr-[5px]",
            className,
        )}
    >
        {children}
    </button>
);

const SecondaryButton = ({
    children,
    className,
    ...rest
}: ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button
        {...rest}
        className={cn(
            "inline-flex items-center justify-center gap-2 h-11 px-4 rounded-lg border border-border bg-secondary/40 text-foreground font-medium hover:border-border-strong hover:bg-secondary transition-colors",
            className,
        )}
    >
        {children}
    </button>
);

const Pill = ({
    children,
    icon: Icon,
}: {
    children: ReactNode;
    icon?: typeof Globe;
}) => (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-secondary text-foreground text-xs font-medium capitalize">
        {Icon && <Icon className="w-3 h-3" />}
        {children}
    </span>
);

const InfoNote = ({ children }: { children: ReactNode }) => (
    <div className="mt-4 flex items-start gap-2 p-3 rounded-lg bg-info/10 border border-info/20 text-xs text-foreground/80">
        <Shield className="w-4 h-4 shrink-0 mt-0.5 text-info" />
        <span>{children}</span>
    </div>
);

const Detail = ({
    label,
    children,
}: {
    label: string;
    children: ReactNode;
}) => (
    <div className="flex items-center justify-between gap-3">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">
            {label}
        </div>
        <div>{children}</div>
    </div>
);

const RoleCard = ({
    icon: Icon,
    title,
    desc,
    bullets,
    selected,
    onClick,
}: {
    icon: typeof Layers;
    title: string;
    desc: string;
    bullets: string[];
    selected: boolean;
    onClick: () => void;
}) => (
    <button
        onClick={onClick}
        className={cn(
            "text-left p-4 rounded-lg border transition-colors relative overflow-hidden",
            selected
                ? "border-primary bg-primary/5 shadow-signal"
                : "border-border hover:border-border-strong bg-card/50",
        )}
    >
        {selected && (
            <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                <Check className="w-3 h-3 text-primary-foreground" />
            </div>
        )}
        <div
            className={cn(
                "w-9 h-9 rounded-lg flex items-center justify-center mb-3",
                selected ? "bg-gradient-signal" : "bg-secondary",
            )}
        >
            <Icon
                className={cn(
                    "w-4 h-4",
                    selected ? "text-primary-foreground" : "text-primary",
                )}
            />
        </div>
        <div className="font-display font-semibold">{title}</div>
        <p className="text-xs text-muted-foreground mt-1 mb-3">{desc}</p>
        <ul className="space-y-1">
            {bullets.map((b) => (
                <li
                    key={b}
                    className="text-xs text-muted-foreground flex items-start gap-1.5"
                >
                    <span className="w-1 h-1 rounded-full bg-primary mt-1.5" />{" "}
                    {b}
                </li>
            ))}
        </ul>
    </button>
);

const _NetworkCard_UNUSED = ({
    name,
    badge,
    badgeTone,
    desc,
    selected,
    onClick,
}: {
    name: string;
    badge: string;
    badgeTone: "success" | "info";
    desc: string;
    selected: boolean;
    onClick: () => void;
}) => (
    <button
        onClick={onClick}
        className={cn(
            "text-left p-4 rounded-lg border transition-colors relative",
            selected
                ? "border-primary bg-primary/5 shadow-signal"
                : "border-border hover:border-border-strong bg-card/50",
        )}
    >
        {selected && (
            <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                <Check className="w-3 h-3 text-primary-foreground" />
            </div>
        )}
        <div className="flex items-center gap-2 mb-2">
            <div
                className={cn(
                    "w-9 h-9 rounded-lg flex items-center justify-center",
                    selected ? "bg-gradient-signal" : "bg-secondary",
                )}
            >
                <Globe
                    className={cn(
                        "w-4 h-4",
                        selected ? "text-primary-foreground" : "text-primary",
                    )}
                />
            </div>
            <span
                className={cn(
                    "text-xs uppercase tracking-wider px-1.5 py-0.5 rounded",
                    badgeTone === "success"
                        ? "bg-success/15 text-success"
                        : "bg-info/15 text-info",
                )}
            >
                {badge}
            </span>
        </div>
        <div className="font-display font-semibold">{name}</div>
        <p className="text-xs text-muted-foreground mt-1">{desc}</p>
    </button>
);
