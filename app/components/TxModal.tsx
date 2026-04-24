import { useEffect, useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, CheckCircle2, AlertCircle, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PublicKey } from "@solana/web3.js";

type Stage = "idle" | "sign" | "submitted" | "confirmed" | "failed";

type TxModalProps = {
    open: boolean;
    onOpenChange: (o: boolean) => void;
    kind?: string;
    /**
     * Optional async sender callback that performs:
     *  - prepare/sign/send
     *  - returns the transaction signature on success
     *
     * If provided, the modal will automatically run the lifecycle when opened.
     */
    onSend?: () => Promise<string>;
    /**
     * Optional explorer base URL (e.g. https://explorer.solana.com)
     */
    explorerUrl?: string;
};

export const TxModal = ({
    open,
    onOpenChange,
    kind = "deposit",
    onSend,
    explorerUrl,
}: TxModalProps) => {
    const [stage, setStage] = useState<Stage>("idle");
    const [signature, setSignature] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        // Reset when closed
        if (!open) {
            setStage("idle");
            setSignature(null);
            setError(null);
            return;
        }

        // If an onSend handler is provided, run the real lifecycle.
        if (onSend) {
            let cancelled = false;
            const run = async () => {
                try {
                    setStage("sign");
                    // awaiting wallet signature & submission
                    const sig = await onSend();
                    if (cancelled) return;
                    setSignature(sig);
                    setStage("confirmed");
                } catch (err: any) {
                    if (cancelled) return;
                    setError(err?.message ?? String(err));
                    setStage("failed");
                }
            };
            // small micro-delay to allow modal open animation to complete
            const t = setTimeout(run, 150);
            return () => {
                cancelled = true;
                clearTimeout(t);
            };
        }

        // If no onSend provided, fall back to simulated UX
        setStage("sign");
        const t1 = setTimeout(() => setStage("submitted"), 900);
        const t2 = setTimeout(() => setStage("confirmed"), 2200);
        return () => {
            clearTimeout(t1);
            clearTimeout(t2);
        };
    }, [open, onSend]);

    const retry = async () => {
        if (!onSend) return;
        setStage("sign");
        setError(null);
        try {
            const sig = await onSend();
            setSignature(sig);
            setStage("confirmed");
        } catch (err: any) {
            setError(err?.message ?? String(err));
            setStage("failed");
        }
    };

    const explorerLink = signature
        ? `${explorerUrl ?? "https://explorer.solana.com"}/tx/${signature}?cluster=devnet`
        : null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="surface-elevated sm:max-w-sm">
                <DialogHeader>
                    <DialogTitle className="font-display capitalize">
                        {kind} transaction
                    </DialogTitle>
                </DialogHeader>

                <div className="py-6 flex flex-col items-center text-center gap-4">
                    {stage === "sign" && (
                        <>
                            <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                                <Wallet className="w-6 h-6 text-primary animate-pulse" />
                            </div>
                            <div>
                                <div className="font-semibold">
                                    Awaiting signature
                                </div>
                                <p className="text-sm text-muted-foreground mt-1">
                                    Confirm in your wallet to continue.
                                </p>
                            </div>
                        </>
                    )}

                    {stage === "submitted" && (
                        <>
                            <Loader2 className="w-10 h-10 text-primary animate-spin" />
                            <div>
                                <div className="font-semibold">Submitting…</div>
                                <p className="text-sm text-muted-foreground mt-1">
                                    Broadcasting to Solana.
                                </p>
                            </div>
                        </>
                    )}

                    {stage === "confirmed" && (
                        <>
                            <div className="w-14 h-14 rounded-full bg-success/10 flex items-center justify-center">
                                <CheckCircle2 className="w-7 h-7 text-success" />
                            </div>
                            <div>
                                <div className="font-semibold">Confirmed</div>
                                <p className="text-sm text-muted-foreground mt-1">
                                    Transaction settled on-chain.
                                </p>
                                {signature && (
                                    <p className="text-xs text-muted-foreground mt-2 break-all">
                                        Signature:{" "}
                                        <span className="font-mono">
                                            {signature}
                                        </span>
                                    </p>
                                )}
                                {explorerLink && (
                                    <a
                                        className="text-sm text-primary mt-1 underline"
                                        href={explorerLink}
                                        target="_blank"
                                        rel="noreferrer"
                                    >
                                        View on Explorer
                                    </a>
                                )}
                            </div>
                            <Button
                                onClick={() => onOpenChange(false)}
                                className="w-full mt-2"
                            >
                                Done
                            </Button>
                        </>
                    )}

                    {stage === "failed" && (
                        <>
                            <AlertCircle className="w-10 h-10 text-destructive" />
                            <div>
                                <div className="font-semibold">
                                    Transaction failed
                                </div>
                                <p className="text-sm text-muted-foreground mt-1">
                                    {error ?? "Try again or check your wallet."}
                                </p>
                                <div className="flex gap-2 mt-4 w-full">
                                    <Button
                                        variant="outline"
                                        onClick={() => onOpenChange(false)}
                                        className="w-full"
                                    >
                                        Close
                                    </Button>
                                    {onSend && (
                                        <Button
                                            onClick={retry}
                                            className="w-full"
                                        >
                                            Retry
                                        </Button>
                                    )}
                                </div>
                            </div>
                        </>
                    )}

                    {stage === "idle" && (
                        <>
                            <div className="w-14 h-14 rounded-full bg-secondary/10 flex items-center justify-center">
                                <Wallet className="w-6 h-6 text-muted-foreground" />
                            </div>
                            <div>
                                <div className="font-semibold">Ready</div>
                                <p className="text-sm text-muted-foreground mt-1">
                                    Press confirm in the app to begin.
                                </p>
                            </div>
                            <div className="w-full mt-4">
                                {onSend ? (
                                    <Button
                                        onClick={() => {
                                            /* caller should trigger open + onSend via parent */
                                        }}
                                        className="w-full"
                                    >
                                        Begin
                                    </Button>
                                ) : (
                                    <Button
                                        onClick={() => onOpenChange(false)}
                                        className="w-full"
                                    >
                                        Close
                                    </Button>
                                )}
                            </div>
                        </>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
};
