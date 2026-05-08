import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Play, Pause, SkipForward, SkipBack, X, Clapperboard } from "lucide-react";
import { toast } from "sonner";
import { useWallet } from "@/lib/wallet";
import { mockStore } from "@/lib/mockStore";
import { DEMO_STEPS, PHASE_META } from "@/lib/demoScript";
import { cn } from "@/lib/utils";

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export function DemoRunner() {
  const navigate = useNavigate();
  const { connect, setRole } = useWallet();
  const queryClient = useQueryClient();

  const [isActive, setIsActive] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [stepIdx, setStepIdx] = useState(0);
  const [progress, setProgress] = useState(0);

  const newVaultIdRef = useRef<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rafRef = useRef<number | null>(null);
  const stepStartRef = useRef<number>(0);
  const pausedAtRef = useRef<number>(0);
  const remainingRef = useRef<number>(0);
  const isPausedRef = useRef(false);
  const stepIdxRef = useRef(0);

  // Keep refs in sync with state
  useEffect(() => { isPausedRef.current = isPaused; }, [isPaused]);
  useEffect(() => { stepIdxRef.current = stepIdx; }, [stepIdx]);

  const stopDemo = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    timerRef.current = null;
    rafRef.current = null;
    setIsActive(false);
    setIsPaused(false);
    setStepIdx(0);
    setProgress(0);
    newVaultIdRef.current = null;
  }, []);

  // Run actions for a given step id
  const runAction = useCallback(async (stepId: string) => {
    switch (stepId) {
      case "connect-trader":
        connect("Demo Wallet");
        setRole("trader");
        break;

      case "create-vault-submit": {
        toast.info("Initialising manager profile…");
        await sleep(700);
        toast.info("Creating vault on-chain…");
        await sleep(900);
        toast.info("Depositing junior capital…");
        await sleep(700);
        const id = mockStore.createVault({
          name: "Alpha Momentum",
          feeBps: 2000,
          maxSlippageBps: 200,
          juniorAmount: 10_000,
        });
        newVaultIdRef.current = id;
        queryClient.invalidateQueries({ queryKey: ["vaults"] });
        toast.success("Vault created — 10,000 USDC junior capital posted");
        break;
      }

      case "paper-mode":
        if (newVaultIdRef.current) navigate(`/manager/vault/${newVaultIdRef.current}`);
        break;

      case "execute-trades": {
        const vid = newVaultIdRef.current;
        if (!vid) break;
        const trades = [
          { pair: "SOL → USDC", amount: 2500 },
          { pair: "ETH → USDC", amount: 1800 },
          { pair: "JUP → USDC", amount: 1200 },
          { pair: "SOL → USDC", amount: 3000 },
        ];
        for (const t of trades) {
          await sleep(1600);
          if (isPausedRef.current) break;
          mockStore.executeTrade(vid, t.pair, t.amount);
          queryClient.invalidateQueries({ queryKey: ["vaults"] });
          toast.info(`Paper trade executed: ${t.pair} · ${t.amount.toLocaleString()} USDC`);
        }
        break;
      }

      case "vault-post-trades":
        if (newVaultIdRef.current) navigate(`/manager/vault/${newVaultIdRef.current}`);
        break;

      case "graduate": {
        const vid = newVaultIdRef.current;
        if (!vid) break;
        await sleep(600);
        mockStore.graduateVault(vid);
        queryClient.invalidateQueries({ queryKey: ["vaults"] });
        toast.success("Vault graduated! Investor deposits now open.");
        break;
      }

      case "switch-investor":
        setRole("investor");
        break;

      case "deposit":
        await sleep(1500);
        mockStore.depositSenior("vlt-001", 50_000);
        queryClient.invalidateQueries({ queryKey: ["vaults"] });
        toast.success("Deposited 50,000 USDC into Signal Macro I");
        break;
    }
  }, [connect, setRole, navigate, queryClient]);

  // Animate the progress bar using rAF
  const startProgressRaf = useCallback((duration: number, startTime: number) => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    const tick = () => {
      if (isPausedRef.current) return;
      const elapsed = Date.now() - startTime;
      const pct = Math.min(100, (elapsed / duration) * 100);
      setProgress(pct);
      if (pct < 100) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  // Advance to next step or end demo
  const advanceStep = useCallback(() => {
    setStepIdx((prev) => {
      const next = prev + 1;
      if (next >= DEMO_STEPS.length) {
        return prev; // handled below
      }
      return next;
    });
  }, []);

  // Core step runner — called whenever stepIdx changes while active
  const runStep = useCallback(async (idx: number) => {
    if (idx >= DEMO_STEPS.length) {
      toast.success("Demo complete!", { description: "All flows demonstrated." });
      stopDemo();
      return;
    }

    const step = DEMO_STEPS[idx];
    setProgress(0);

    // Navigate if step has a static route
    if (step.route) navigate(step.route);

    // Small settle delay after navigation
    await sleep(300);

    // Run any programmatic action for this step
    await runAction(step.id);

    // Start the countdown
    const duration = step.duration;
    stepStartRef.current = Date.now();
    remainingRef.current = duration;
    startProgressRaf(duration, stepStartRef.current);

    timerRef.current = setTimeout(() => {
      if (stepIdxRef.current < DEMO_STEPS.length - 1) {
        advanceStep();
      } else {
        toast.success("Demo complete!", { description: "All flows demonstrated." });
        stopDemo();
      }
    }, duration);
  }, [navigate, runAction, startProgressRaf, advanceStep, stopDemo]);

  // Run step whenever stepIdx changes while demo is active
  useEffect(() => {
    if (!isActive || isPaused) return;
    runStep(stepIdx);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepIdx, isActive]);

  // Start demo when not running
  const startDemo = useCallback(() => {
    mockStore.reset();
    queryClient.invalidateQueries({ queryKey: ["vaults"] });
    queryClient.invalidateQueries({ queryKey: ["managers"] });
    newVaultIdRef.current = null;
    setStepIdx(0);
    setProgress(0);
    setIsPaused(false);
    setIsActive(true);
  }, [queryClient]);

  // Listen for the global trigger event fired by the nav button
  useEffect(() => {
    const handler = () => startDemo();
    window.addEventListener("kiln:demo-start", handler);
    return () => window.removeEventListener("kiln:demo-start", handler);
  }, [startDemo]);

  // Pause / resume
  const togglePause = useCallback(() => {
    if (!isActive) return;
    if (isPaused) {
      // Resume — restart timer with remaining time
      const remaining = remainingRef.current;
      setIsPaused(false);
      isPausedRef.current = false;
      const newStart = Date.now() - (DEMO_STEPS[stepIdx].duration - remaining);
      stepStartRef.current = newStart;
      startProgressRaf(DEMO_STEPS[stepIdx].duration, newStart);
      timerRef.current = setTimeout(() => {
        if (stepIdxRef.current < DEMO_STEPS.length - 1) {
          advanceStep();
        } else {
          toast.success("Demo complete!");
          stopDemo();
        }
      }, remaining);
    } else {
      // Pause — record how much time is left
      if (timerRef.current) clearTimeout(timerRef.current);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      const elapsed = Date.now() - stepStartRef.current;
      remainingRef.current = Math.max(0, DEMO_STEPS[stepIdx].duration - elapsed);
      pausedAtRef.current = Date.now();
      setIsPaused(true);
      isPausedRef.current = true;
    }
  }, [isActive, isPaused, stepIdx, startProgressRaf, advanceStep, stopDemo]);

  // Skip to next / prev step
  const skipNext = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    setIsPaused(false);
    isPausedRef.current = false;
    setStepIdx((p) => Math.min(DEMO_STEPS.length - 1, p + 1));
  }, []);

  const skipPrev = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    setIsPaused(false);
    isPausedRef.current = false;
    setStepIdx((p) => Math.max(0, p - 1));
  }, []);

  const step = DEMO_STEPS[stepIdx];
  const phase = step?.phase;
  const phaseMeta = phase ? PHASE_META[phase] : null;

  return (
    <AnimatePresence>
      {isActive && step && (
        <motion.div
          key="demo-hud"
          initial={{ opacity: 0, y: 32, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 24, scale: 0.96 }}
          transition={{ type: "spring", stiffness: 340, damping: 30 }}
          className="fixed bottom-5 left-1/2 z-[200] w-[min(96vw,680px)] -translate-x-1/2"
        >
          <div className="overflow-hidden rounded-2xl border border-border/60 bg-background/95 shadow-2xl backdrop-blur-xl ring-1 ring-white/5">
            {/* ── Top bar ─────────────────────────────────────────────── */}
            <div className="flex items-center justify-between gap-3 border-b border-border/40 px-4 py-2.5">
              <div className="flex items-center gap-2">
                <span className="flex h-5 items-center gap-1.5 rounded-full bg-destructive/15 px-2 font-mono text-[10px] font-bold uppercase tracking-widest text-destructive">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-destructive" />
                  Live Demo
                </span>
                {phaseMeta && (
                  <span className={cn("flex items-center gap-1.5 font-mono text-[11px] font-semibold", phaseMeta.color)}>
                    <span className={cn("h-1.5 w-1.5 rounded-full", phaseMeta.dot)} />
                    {phaseMeta.label}
                  </span>
                )}
              </div>
              <span className="font-mono text-[11px] text-muted-foreground">
                {stepIdx + 1} / {DEMO_STEPS.length}
              </span>
            </div>

            {/* ── Caption ─────────────────────────────────────────────── */}
            <AnimatePresence mode="wait">
              <motion.div
                key={step.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.2 }}
                className="px-5 pb-3 pt-4"
              >
                <p className="font-display text-[17px] font-semibold leading-snug text-foreground">
                  {step.caption}
                </p>
                <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
                  {step.subcaption}
                </p>
              </motion.div>
            </AnimatePresence>

            {/* ── Progress bar ─────────────────────────────────────────── */}
            <div className="mx-5 mb-3 h-[3px] overflow-hidden rounded-full bg-secondary">
              <motion.div
                className={cn(
                  "h-full rounded-full",
                  phase === "overview" ? "bg-primary" :
                  phase === "trader"   ? "bg-warning"  :
                                         "bg-success"
                )}
                style={{ width: `${progress}%` }}
                transition={{ ease: "linear" }}
              />
            </div>

            {/* ── Controls ─────────────────────────────────────────────── */}
            <div className="flex items-center gap-1.5 border-t border-border/40 px-4 py-2.5">
              <ControlBtn onClick={skipPrev} disabled={stepIdx === 0} title="Previous step">
                <SkipBack className="h-3.5 w-3.5" />
              </ControlBtn>
              <ControlBtn onClick={togglePause} title={isPaused ? "Resume" : "Pause"} accent>
                {isPaused
                  ? <Play className="h-3.5 w-3.5 translate-x-px" />
                  : <Pause className="h-3.5 w-3.5" />}
              </ControlBtn>
              <ControlBtn onClick={skipNext} disabled={stepIdx === DEMO_STEPS.length - 1} title="Skip step">
                <SkipForward className="h-3.5 w-3.5" />
              </ControlBtn>

              {/* Step dots */}
              <div className="mx-2 flex flex-1 items-center justify-center gap-1 overflow-hidden">
                {DEMO_STEPS.map((s, i) => (
                  <button
                    key={s.id}
                    onClick={() => {
                      if (timerRef.current) clearTimeout(timerRef.current);
                      if (rafRef.current) cancelAnimationFrame(rafRef.current);
                      setIsPaused(false);
                      isPausedRef.current = false;
                      setStepIdx(i);
                    }}
                    className={cn(
                      "h-1.5 rounded-full transition-[width,opacity]",
                      i === stepIdx
                        ? cn("opacity-100", phase === "investor" ? "bg-success w-4" : phase === "trader" ? "bg-warning w-4" : "bg-primary w-4")
                        : i < stepIdx
                          ? "w-1.5 bg-muted-foreground/60 opacity-80"
                          : "w-1.5 bg-muted-foreground/25 opacity-50"
                    )}
                    title={s.caption}
                  />
                ))}
              </div>

              <ControlBtn onClick={stopDemo} title="End demo" danger>
                <X className="h-3.5 w-3.5" />
              </ControlBtn>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ── Small helper button ─────────────────────────────────────────────────── */
function ControlBtn({
  children,
  onClick,
  disabled,
  title,
  accent,
  danger,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  title?: string;
  accent?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        "flex h-8 w-8 items-center justify-center rounded-lg transition-colors disabled:opacity-30",
        accent
          ? "bg-primary text-primary-foreground hover:bg-primary/90"
          : danger
            ? "text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            : "text-muted-foreground hover:bg-secondary hover:text-foreground"
      )}
    >
      {children}
    </button>
  );
}

/* ── Trigger button rendered in the Nav ─────────────────────────────────── */
export function DemoTriggerButton({ className }: { className?: string }) {
  const fire = () => window.dispatchEvent(new CustomEvent("kiln:demo-start"));
  return (
    <button
      onClick={fire}
      title="Play hands-free demo"
      className={cn(
        "hidden sm:inline-flex items-center gap-1.5 h-9 rounded-lg border border-border/60 px-3",
        "font-mono text-[11px] font-semibold uppercase tracking-wider text-muted-foreground",
        "hover:border-primary/50 hover:bg-primary/5 hover:text-primary transition-colors",
        className
      )}
    >
      <Clapperboard className="h-3.5 w-3.5" />
      Demo
    </button>
  );
}
