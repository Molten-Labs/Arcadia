import { useEffect, useMemo, useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    AlertCircle,
    CheckCircle2,
    Clock3,
    ExternalLink,
    Loader2,
    RotateCcw,
    ShieldCheck,
    Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type Stage = "sign" | "submitted" | "confirmed" | "failed";

type TxModalProps = {
    open: boolean;
    onOpenChange: (o: boolean) => void;
    kind?: string;
    amountLabel?: string;
    network?: "mainnet" | "devnet";
    simulateFailure?: boolean;
    onRetry?: () => void;
    onStageChange?: (stage: Stage) => void;
};

const stageCopy: Record<Stage, { label: string; description: string }> = {
    sign: {
        label: "Awaiting signature",
        description:
            "Review the operation, network, fee estimate, and risk controls before approving.",
    },
    submitted: {
        label: "Submitting transaction",
        description:
            "Broadcasting the signed payload and waiting for cluster acknowledgement.",
    },
    confirmed: {
        label: "Confirmed",
        description:
            "The preview transaction completed successfully. No real funds moved in this frontend build.",
    },
    failed: {
        label: "Transaction failed",
        description:
            "The request could not be completed. Check wallet state, network, and balances before retrying.",
    },
};

export const TxModal = ({
    open,
    onOpenChange,
    kind = "deposit",
    amountLabel = "Preview amount",
    network = "devnet",
    simulateFailure = false,
    onRetry,
    onStageChange,
}: TxModalProps) => {
    const [stage, setStage] = useState<Stage>("sign");
    const [signature, setSignature] = useState("");

    const normalizedKind = kind.replace(/\s+/g, " ").trim() || "transaction";

    const explorerUrl = useMemo(() => {
        if (!signature) return "";
        const cluster = network === "devnet" ? "?cluster=devnet" : "";
        return `https://solscan.io/tx/${signature}${cluster}`;
    }, [network, signature]);

    const restart = () => {
        setStage("sign");
        setSignature("");
        onRetry?.();
    };

    useEffect(() => {
        if (!open) return;

        setStage("sign");
        setSignature("");

        const txSeed = `${normalizedKind}-${Date.now()}`;
        const demoSignature = `demo_${Array.from(txSeed)
            .reduce((acc, char) => acc + char.charCodeAt(0).toString(16), "")
            .slice(0, 40)}`;

        const t1 = setTimeout(() => {
            setSignature(demoSignature);
            setStage("submitted");
        }, 900);

        const t2 = setTimeout(() => {
            setStage(simulateFailure ? "failed" : "confirmed");
        }, 2300);

        return () => {
            clearTimeout(t1);
            clearTimeout(t2);
        };
    }, [open, normalizedKind, simulateFailure]);

    useEffect(() => {
        if (open) onStageChange?.(stage);
    }, [open, onStageChange, stage]);

    const isPending = stage === "sign" || stage === "submitted";
    const copy = stageCopy[stage];

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="surface-elevated overflow-hidden border-border-strong p-0 sm:max-w-md">
                <div className="h-1 bg-gradient-signal" />
                <div className="p-6">
                    <DialogHeader>
                        <DialogTitle className="font-display capitalize">
                            {normalizedKind} transaction
                        </DialogTitle>
                    </DialogHeader>

                    <div className="py-6 flex flex-col items-center text-center gap-4">
                        <div
                            className={cn(
                                "w-16 h-16 rounded-lg border flex items-center justify-center",
                                stage === "confirmed" &&
                                    "border-success/30 bg-success/10",
                                stage === "failed" &&
                                    "border-destructive/30 bg-destructive/10",
                                isPending && "border-primary/30 bg-primary/10",
                            )}
                        >
                            {stage === "sign" && (
                                <Wallet className="w-7 h-7 text-primary animate-pulse" />
                            )}
                            {stage === "submitted" && (
                                <Loader2 className="w-7 h-7 text-primary animate-spin" />
                            )}
                            {stage === "confirmed" && (
                                <CheckCircle2 className="w-8 h-8 text-success" />
                            )}
                            {stage === "failed" && (
                                <AlertCircle className="w-8 h-8 text-destructive" />
                            )}
                        </div>

                        <div>
                            <div className="font-semibold">{copy.label}</div>
                            <p className="text-sm text-muted-foreground mt-1">
                                {copy.description}
                            </p>
                        </div>

                        <div className="w-full rounded-lg border border-border bg-background-secondary/60 p-4 text-left text-xs">
                            <div className="grid gap-3">
                                <Detail label="Action" value={normalizedKind} />
                                <Detail label="Amount" value={amountLabel} />
                                <Detail
                                    label="Network"
                                    value={network}
                                    capitalize
                                />
                                <Detail
                                    label="Estimated fee"
                                    value="~0.0008 SOL"
                                />
                                <Detail
                                    label="Signature"
                                    value={
                                        signature
                                            ? `${signature.slice(0, 12)}…${signature.slice(-8)}`
                                            : "Pending wallet approval"
                                    }
                                    mono
                                />
                            </div>
                        </div>

                        <div className="w-full rounded-lg border border-info/20 bg-info/10 p-3 text-left text-xs text-foreground/80">
                            <div className="flex gap-2">
                                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-info" />
                                <span>
                                    This modal models the full transaction
                                    lifecycle for QA. Production should replace
                                    the timer with wallet signing,
                                    sendTransaction, confirmation polling, and
                                    explorer-backed status.
                                </span>
                            </div>
                        </div>

                        <div className="flex w-full items-center justify-between rounded-lg border border-border bg-card/50 px-3 py-2 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1.5">
                                <Clock3 className="h-3.5 w-3.5" />
                                Status
                            </span>
                            <span className="font-mono capitalize text-foreground">
                                {stage}
                            </span>
                        </div>

                        {stage === "confirmed" && (
                            <div className="grid w-full gap-2 sm:grid-cols-2">
                                <Button
                                    onClick={() => onOpenChange(false)}
                                    className="bg-gradient-signal text-primary-foreground border-0"
                                >
                                    Done
                                </Button>
                                <Button asChild variant="outline">
                                    <a
                                        href={explorerUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                    >
                                        Explorer{" "}
                                        <ExternalLink className="h-4 w-4" />
                                    </a>
                                </Button>
                            </div>
                        )}

                        {stage === "failed" && (
                            <div className="grid w-full gap-2 sm:grid-cols-2">
                                <Button
                                    onClick={restart}
                                    className="bg-gradient-signal text-primary-foreground border-0"
                                >
                                    <RotateCcw className="h-4 w-4" />
                                    Retry
                                </Button>
                                <Button
                                    onClick={() => onOpenChange(false)}
                                    variant="outline"
                                >
                                    Close
                                </Button>
                            </div>
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};

const Detail = ({
    label,
    value,
    mono,
    capitalize,
}: {
    label: string;
    value: string;
    mono?: boolean;
    capitalize?: boolean;
}) => (
    <div className="flex items-center justify-between gap-3">
        <span className="text-muted-foreground">{label}</span>
        <span
            className={cn(
                "text-right font-medium text-foreground",
                mono && "font-mono",
                capitalize && "capitalize",
            )}
        >
            {value}
        </span>
    </div>
);
