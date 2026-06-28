import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Play, Pause, SkipForward, SkipBack, X,
  Clapperboard, ChevronDown, ChevronUp, Maximize2,
} from "lucide-react";
import { toast } from "sonner";
import { useWallet } from "@/lib/wallet";
import { mockStore } from "@/lib/mockStore";
import { DEMO_STEPS, PHASE_META } from "@/lib/demoScript";
import { cn } from "@/lib/utils";

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const DEMO_SPEED_MULTIPLIER = 4 / 3;

const getStepDuration = (idx: number) =>
  (DEMO_STEPS[idx]?.duration ?? 0) * DEMO_SPEED_MULTIPLIER;

export function DemoRunner() {
  const navigate = useNavigate();
  const { connectDemoWallet, setRole } = useWallet();
  const queryClient = useQueryClient();

  const [isActive, setIsActive]       = useState(false);
  const [isPaused, setIsPaused]       = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [stepIdx, setStepIdx]         = useState(0);
  const [progress, setProgress]       = useState(0);

  const newVaultIdRef  = useRef<string | null>(null);
  const timerRef       = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rafRef         = useRef<number | null>(null);
  const stepStartRef   = useRef<number>(0);
  const remainingRef   = useRef<number>(0);
  const isPausedRef    = useRef(false);
  const stepIdxRef     = useRef(0);

  useEffect(() => { isPausedRef.current = isPaused; }, [isPaused]);
  useEffect(() => { stepIdxRef.current = stepIdx; },  [stepIdx]);

  // ── Stop ──────────────────────────────────────────────────────────────────
  const stopDemo = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (rafRef.current)   cancelAnimationFrame(rafRef.current);
    timerRef.current = null;
    rafRef.current   = null;
    setIsActive(false);
    setIsPaused(false);
    setIsMinimized(false);
    setStepIdx(0);
    setProgress(0);
    newVaultIdRef.current = null;
  }, []);

  // ── Internal pause helper (shared by togglePause & minimize) ──────────────
  const doPause = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (rafRef.current)   cancelAnimationFrame(rafRef.current);
    const elapsed = Date.now() - stepStartRef.current;
    remainingRef.current = Math.max(0, getStepDuration(stepIdxRef.current) - elapsed);
    setIsPaused(true);
    isPausedRef.current = true;
  }, []);

  // ── Internal resume helper ─────────────────────────────────────────────────
  const advanceStep = useCallback(() => {
    setStepIdx((p) => Math.min(DEMO_STEPS.length - 1, p + 1));
  }, []);

  const doResume = useCallback(() => {
    const remaining = remainingRef.current;
    setIsPaused(false);
    isPausedRef.current = false;
    const newStart = Date.now() - (getStepDuration(stepIdxRef.current) - remaining);
    stepStartRef.current = newStart;

    // rAF progress
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    const duration = getStepDuration(stepIdxRef.current);
    const tick = () => {
      if (isPausedRef.current) return;
      const pct = Math.min(100, ((Date.now() - newStart) / duration) * 100);
      setProgress(pct);
      if (pct < 100) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    timerRef.current = setTimeout(() => {
      if (stepIdxRef.current < DEMO_STEPS.length - 1) {
        advanceStep();
      } else {
        toast.success("Demo complete!", { description: "All flows demonstrated." });
        stopDemo();
      }
    }, remaining);
  }, [advanceStep, stopDemo]);

  // ── Minimize / expand ──────────────────────────────────────────────────────
  const minimize = useCallback(() => {
    doPause();
    setIsMinimized(true);
  }, [doPause]);

  const expand = useCallback(() => {
    setIsMinimized(false);
    // Small delay for the panel to animate in before resuming
    setTimeout(() => doResume(), 220);
  }, [doResume]);

  // ── Step actions ───────────────────────────────────────────────────────────
  const runAction = useCallback(async (stepId: string) => {
    switch (stepId) {
      case "connect-trader":
        connectDemoWallet();
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
          { pair: "USDC → SOL", amount: 2500 },
          { pair: "SOL → USDC", amount: 1800 },
          { pair: "USDC → SOL", amount: 1200 },
          { pair: "SOL → USDC", amount: 3000 },
        ];
        for (const t of trades) {
          await sleep(1600);
          if (isPausedRef.current) break;
          mockStore.executeTrade(vid, t.pair, t.amount);
          queryClient.invalidateQueries({ queryKey: ["vaults"] });
          toast.info(`Paper trade: ${t.pair} · ${t.amount.toLocaleString()} USDC`);
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

      case "vault-detail":
        navigate(`/vault/${newVaultIdRef.current ?? "vlt-001"}`);
        break;

      case "deposit":
        await sleep(1500);
        mockStore.depositSenior(newVaultIdRef.current ?? "vlt-001", 50_000);
        queryClient.invalidateQueries({ queryKey: ["vaults"] });
        queryClient.invalidateQueries({ queryKey: ["positions"] });
        toast.success("Deposited 50,000 USDC into the graduated vault");
        break;
    }
  }, [connectDemoWallet, setRole, navigate, queryClient]);

  // ── rAF progress ───────────────────────────────────────────────────────────
  const startProgressRaf = useCallback((duration: number, startTime: number) => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    const tick = () => {
      if (isPausedRef.current) return;
      const pct = Math.min(100, ((Date.now() - startTime) / duration) * 100);
      setProgress(pct);
      if (pct < 100) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  // ── Run a step ─────────────────────────────────────────────────────────────
  const runStep = useCallback(async (idx: number) => {
    if (idx >= DEMO_STEPS.length) {
      toast.success("Demo complete!", { description: "All flows demonstrated." });
      stopDemo();
      return;
    }
    const step = DEMO_STEPS[idx];
    setProgress(0);
    if (step.route) navigate(step.route);
    await sleep(300);
    await runAction(step.id);

    const duration = getStepDuration(idx);
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

  // Run step when stepIdx changes while active (and not paused)
  useEffect(() => {
    if (!isActive || isPaused) return;
    runStep(stepIdx);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (rafRef.current)   cancelAnimationFrame(rafRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepIdx, isActive]);

  // ── Start ──────────────────────────────────────────────────────────────────
  const startDemo = useCallback(() => {
    mockStore.reset();
    queryClient.invalidateQueries({ queryKey: ["vaults"] });
    queryClient.invalidateQueries({ queryKey: ["managers"] });
    newVaultIdRef.current = null;
    setStepIdx(0);
    setProgress(0);
    setIsPaused(false);
    setIsMinimized(false);
    setIsActive(true);
  }, [queryClient]);

  useEffect(() => {
    const handler = () => startDemo();
    window.addEventListener("kiln:demo-start", handler);
    return () => window.removeEventListener("kiln:demo-start", handler);
  }, [startDemo]);

  // ── Pause / resume toggle ──────────────────────────────────────────────────
  const togglePause = useCallback(() => {
    if (!isActive) return;
    if (isPaused) doResume(); else doPause();
  }, [isActive, isPaused, doPause, doResume]);

  // ── Skip ──────────────────────────────────────────────────────────────────
  const skipNext = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (rafRef.current)   cancelAnimationFrame(rafRef.current);
    setIsPaused(false);
    isPausedRef.current = false;
    setStepIdx((p) => Math.min(DEMO_STEPS.length - 1, p + 1));
  }, []);

  const skipPrev = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (rafRef.current)   cancelAnimationFrame(rafRef.current);
    setIsPaused(false);
    isPausedRef.current = false;
    setStepIdx((p) => Math.max(0, p - 1));
  }, []);

  const jumpTo = useCallback((i: number) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (rafRef.current)   cancelAnimationFrame(rafRef.current);
    setIsPaused(false);
    isPausedRef.current = false;
    setStepIdx(i);
  }, []);

  // ── Derived ────────────────────────────────────────────────────────────────
  const step      = DEMO_STEPS[stepIdx];
  const phase     = step?.phase;
  const phaseMeta = phase ? PHASE_META[phase] : null;
  const phaseColor = phase === "investor" ? "bg-success" : phase === "trader" ? "bg-warning" : "bg-primary";
  const phaseText  = phase === "investor" ? "text-success" : phase === "trader" ? "text-warning" : "text-primary";

  if (!isActive || !step) return null;

  return (
    <>
      {/* ── Minimized chip ──────────────────────────────────────────────── */}
      <AnimatePresence>
        {isMinimized && (
          <motion.div
            key="demo-chip"
            initial={{ opacity: 0, y: 16, scale: 0.92 }}
            animate={{ opacity: 1, y: 0,  scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.9 }}
            transition={{ type: "spring", stiffness: 380, damping: 32 }}
            className="fixed bottom-5 right-5 z-[200]"
          >
            <div className="flex items-center gap-2 rounded-2xl border border-border/60 bg-background/95 px-3 py-2 shadow-2xl backdrop-blur-xl ring-1 ring-white/5">
              {/* Live badge */}
              <span className="flex items-center gap-1.5 rounded-full bg-destructive/15 px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-widest text-destructive">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-destructive" />
                Demo
              </span>

              {/* Phase + caption snippet */}
              <div className="flex flex-col min-w-0 max-w-[180px]">
                {phaseMeta && (
                  <span className={cn("font-mono text-[9px] font-semibold uppercase tracking-wider", phaseText)}>
                    {phaseMeta.label}
                  </span>
                )}
                <span className="truncate font-display text-[12px] font-semibold text-foreground leading-tight">
                  {step.caption}
                </span>
              </div>

              {/* Step counter */}
              <span className="font-mono text-[10px] text-muted-foreground shrink-0">
                {stepIdx + 1}/{DEMO_STEPS.length}
              </span>

              {/* Paused indicator */}
              <span className="flex items-center gap-1 rounded-md bg-secondary px-1.5 py-0.5 font-mono text-[9px] text-muted-foreground shrink-0">
                <Pause className="h-2.5 w-2.5" />
                Paused
              </span>

              {/* Expand button */}
              <button
                onClick={expand}
                title="Expand demo controls"
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
              >
                <Maximize2 className="h-3.5 w-3.5" />
              </button>

              {/* Stop */}
              <button
                onClick={stopDemo}
                title="End demo"
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Expanded panel ──────────────────────────────────────────────── */}
      <AnimatePresence>
        {!isMinimized && (
          <motion.div
            key="demo-hud"
            initial={{ opacity: 0, y: 32, scale: 0.97 }}
            animate={{ opacity: 1, y: 0,  scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.96 }}
            transition={{ type: "spring", stiffness: 340, damping: 30 }}
            className="fixed bottom-5 left-1/2 z-[200] w-[min(96vw,680px)] -translate-x-1/2"
          >
            <div className="overflow-hidden rounded-2xl border border-border/60 bg-background/95 shadow-2xl backdrop-blur-xl ring-1 ring-white/5">

              {/* ── Header ──────────────────────────────────────────────── */}
              <div className="flex items-center justify-between gap-3 border-b border-border/40 px-4 py-2.5">
                <div className="flex items-center gap-2">
                  <span className="flex h-5 items-center gap-1.5 rounded-full bg-destructive/15 px-2 font-mono text-[10px] font-bold uppercase tracking-widest text-destructive">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-destructive" />
                    Live Demo
                  </span>
                  {phaseMeta && (
                    <span className={cn("flex items-center gap-1.5 font-mono text-[11px] font-semibold", phaseText)}>
                      <span className={cn("h-1.5 w-1.5 rounded-full", phaseColor)} />
                      {phaseMeta.label}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1">
                  <span className="font-mono text-[11px] text-muted-foreground mr-1">
                    {stepIdx + 1} / {DEMO_STEPS.length}
                  </span>
                  {/* Minimize */}
                  <button
                    onClick={minimize}
                    title="Minimise — pauses timer so you can narrate freely"
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
                  >
                    <ChevronDown className="h-4 w-4" />
                  </button>
                </div>
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
                  className={cn("h-full rounded-full", phaseColor)}
                  style={{ width: `${progress}%` }}
                  transition={{ ease: "linear" }}
                />
              </div>

              {/* ── Controls ─────────────────────────────────────────────── */}
              <div className="flex items-center gap-1.5 border-t border-border/40 px-4 py-2.5">
                <ControlBtn onClick={skipPrev} disabled={stepIdx === 0} title="Previous step">
                  <SkipBack className="h-3.5 w-3.5" />
                </ControlBtn>

                <ControlBtn onClick={togglePause} accent title={isPaused ? "Resume auto-play" : "Pause auto-play"}>
                  {isPaused
                    ? <Play  className="h-3.5 w-3.5 translate-x-px" />
                    : <Pause className="h-3.5 w-3.5" />}
                </ControlBtn>

                <ControlBtn onClick={skipNext} disabled={stepIdx === DEMO_STEPS.length - 1} title="Skip to next step">
                  <SkipForward className="h-3.5 w-3.5" />
                </ControlBtn>

                {/* Step dots */}
                <div className="mx-2 flex flex-1 items-center justify-center gap-1 overflow-hidden">
                  {DEMO_STEPS.map((s, i) => (
                    <button
                      key={s.id}
                      onClick={() => jumpTo(i)}
                      title={s.caption}
                      className={cn(
                        "h-1.5 rounded-full transition-[width,background-color,opacity] duration-200",
                        i === stepIdx
                          ? cn("w-4 opacity-100", phaseColor)
                          : i < stepIdx
                            ? "w-1.5 bg-muted-foreground/60 opacity-80"
                            : "w-1.5 bg-muted-foreground/25 opacity-50"
                      )}
                    />
                  ))}
                </div>

                {/* Minimise shortcut in controls too */}
                <ControlBtn onClick={minimize} title="Minimise — narrate freely, timer pauses">
                  <ChevronDown className="h-3.5 w-3.5" />
                </ControlBtn>

                <ControlBtn onClick={stopDemo} danger title="End demo">
                  <X className="h-3.5 w-3.5" />
                </ControlBtn>
              </div>

              {/* ── Minimise hint ────────────────────────────────────────── */}
              {!isPaused && (
                <div className="border-t border-border/30 px-5 py-1.5">
                  <p className="text-[11px] text-muted-foreground/60">
                    Press <kbd className="rounded border border-border/60 bg-secondary px-1 font-mono text-[10px]">↓</kbd> or click minimise to collapse and narrate freely — timer pauses automatically.
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

/* ── Control button ──────────────────────────────────────────────────────── */
function ControlBtn({
  children, onClick, disabled, title, accent, danger,
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

/* ── Nav trigger button ──────────────────────────────────────────────────── */
export function DemoTriggerButton({ className }: { className?: string }) {
  const fire = () => window.dispatchEvent(new CustomEvent("kiln:demo-start"));
  return (
    <button
      onClick={fire}
      title="Start hands-free demo"
      className={cn(
        "inline-flex items-center gap-1.5 h-9 rounded-lg border border-border/60 px-3",
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
