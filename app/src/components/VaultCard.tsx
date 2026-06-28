import { Link } from "react-router-dom";
import type { VaultView } from "@/hooks/useVaults";
import { fmtUSD } from "@/lib/format";
import { StatusBadge } from "./StatusBadge";
import { Shield, Zap } from "lucide-react";
import { shortAddr } from "@/lib/wallet";
import { cn } from "@/lib/utils";
import { useMemo } from "react";

// ── Smooth cubic-bezier SVG sparkline ────────────────────────────────────────
const MiniSparkline = ({
  data,
  vaultId,
  positive,
}: {
  data: number[];
  vaultId: string;
  positive: boolean;
}) => {
  const paths = useMemo(() => {
    if (data.length < 4) return null;
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    const W = 300, H = 44, PAD = 3;
    const pts = data.map((v, i) => ({
      x: (i / (data.length - 1)) * W,
      y: H - PAD - ((v - min) / range) * (H - PAD * 2),
    }));
    // Smooth bezier through each segment
    let line = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
    for (let i = 1; i < pts.length; i++) {
      const cpx = ((pts[i - 1].x + pts[i].x) / 2).toFixed(1);
      line += ` C ${cpx} ${pts[i - 1].y.toFixed(1)} ${cpx} ${pts[i].y.toFixed(1)} ${pts[i].x.toFixed(1)} ${pts[i].y.toFixed(1)}`;
    }
    const area = `${line} L ${W} ${H} L 0 ${H} Z`;
    return { line, area, W, H };
  }, [data]);

  if (!paths) return null;

  const id = `sp-${vaultId.replace(/\W/g, "")}`;
  const stroke = positive ? "hsl(var(--success))" : "hsl(var(--destructive))";

  return (
    <svg
      viewBox={`0 0 ${paths.W} ${paths.H}`}
      className="w-full h-full"
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.22" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <path d={paths.area} fill={`url(#${id})`} />
      <path
        d={paths.line}
        fill="none"
        stroke={stroke}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
};

// ── Vault initials avatar ─────────────────────────────────────────────────────
const VaultAvatar = ({ name, isTop }: { name: string; isTop: boolean }) => {
  const initials = name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <div
      className={cn(
        "w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0",
        "font-display font-bold text-[13px] border",
        isTop
          ? "bg-primary/15 text-primary border-primary/25"
          : "bg-background/75 text-muted-foreground border-border/60"
      )}
    >
      {initials}
    </div>
  );
};

const healthColor = (h: number) =>
  h < 20 ? "text-destructive" : h < 50 ? "text-warning" : "text-success";

const healthBarColor = (h: number) =>
  h < 20 ? "bg-destructive" : h < 50 ? "bg-warning" : "bg-success";

// ── VaultCard ─────────────────────────────────────────────────────────────────
export const VaultCard = ({ vault }: { vault: VaultView }) => {
  const juniorPct =
    vault.tvl > 0 ? Math.round((vault.juniorCapital / vault.tvl) * 100) : 0;
  const isTop = vault.juniorHealth > 80 && vault.status === "active";

  const return30d =
    vault.return30d ??
    (vault.currentNav > 0 && vault.highWaterMark > 0
      ? ((vault.currentNav / vault.highWaterMark) - 1) * 100
      : 0);
  const positive = return30d >= 0;

  const sparkline = vault.sparkline;
  const hasChart = !!sparkline && sparkline.length > 4;

  return (
    <Link
      to={`/vault/${vault.id}`}
      className={cn(
        "relative group surface rounded-[13px] overflow-hidden flex flex-col",
        "apex-lift",
        isTop && "border-primary/25"
      )}
    >
      {/* Top-edge glow for elite vaults */}
      {isTop && (
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent" />
      )}

      {/* ── Header ─────────────────────────────────── */}
      <div className="p-4 pb-3 flex items-start gap-3">
        <VaultAvatar name={vault.name} isTop={isTop} />

        <div className="flex-1 min-w-0">
          <h3 className="font-display font-semibold text-[14px] leading-tight tracking-tight truncate">
            {vault.name}
          </h3>
          <p className="font-mono text-[10px] text-muted-foreground mt-0.5">
            {shortAddr(vault.managerPubkey)}
          </p>
          <div className="flex items-center gap-1.5 mt-2 flex-wrap">
            <StatusBadge status={vault.status} />
            {vault.instantExit && (
              <span className="font-mono text-[9px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 inline-flex items-center gap-1">
                <Zap className="w-2 h-2" /> Instant
              </span>
            )}
            {vault.strategyTags?.slice(0, 2).map((t) => (
              <span
                key={t}
                className="font-mono text-[9px] px-1.5 py-0.5 rounded-full bg-secondary/60 text-muted-foreground border border-border/50"
              >
                {t}
              </span>
            ))}
          </div>
        </div>

        {/* Return % */}
        <div className="text-right shrink-0">
          <div
            className={cn(
              "font-mono font-semibold text-[17px] leading-none tabular",
              positive ? "text-success" : "text-destructive"
            )}
          >
            {positive ? "+" : ""}
            {return30d.toFixed(1)}%
          </div>
          <div className="font-mono text-[9px] text-muted-foreground mt-0.5 uppercase tracking-wider">
            30d
          </div>
        </div>
      </div>

      {/* ── Mini sparkline chart ─────────────────────── */}
      {hasChart && (
        <div className="h-[44px] overflow-hidden relative border-t border-border/25">
          <MiniSparkline
            data={sparkline}
            vaultId={vault.id}
            positive={positive}
          />
        </div>
      )}

      {/* ── Stats grid ──────────────────────────────── */}
      <div
        className={cn(
          "grid grid-cols-3",
          hasChart
            ? "border-t border-border/30 border-b border-b-border/40"
            : "border-b border-border/40"
        )}
      >
        {[
          {
            l: "TVL",
            v: vault.tvl > 0 ? fmtUSD(vault.tvl, { compact: true }) : "—",
          },
          {
            l: "NAV",
            v:
              vault.currentNav > 0
                ? fmtUSD(vault.currentNav, { compact: true })
                : "—",
          },
          { l: "Junior", v: `${juniorPct}%` },
        ].map((s, i) => (
          <div
            key={s.l}
            className={cn(
              "py-2.5 text-center",
              i < 2 && "border-r border-border/40"
            )}
          >
            <div className="font-mono text-[9px] uppercase tracking-[0.1em] text-muted-foreground mb-0.5">
              {s.l}
            </div>
            <div className="font-mono font-medium text-[12px] tabular">
              {s.v}
            </div>
          </div>
        ))}
      </div>

      {/* ── Junior buffer meter ─────────────────────── */}
      <div className="px-4 py-3 space-y-1.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1 font-mono text-[9px] uppercase tracking-[0.1em] text-muted-foreground">
            <Shield className="w-2.5 h-2.5" /> Junior buffer
          </div>
          <span
            className={cn(
              "font-mono text-[11px] font-semibold tabular",
              healthColor(vault.juniorHealth)
            )}
          >
            {Math.round(vault.juniorHealth)}%
          </span>
        </div>
        <div className="h-[3px] bg-secondary/60 rounded-full overflow-hidden">
          <div
            className={cn(
              "h-full rounded-full transition-[width] duration-700 ease-out",
              healthBarColor(vault.juniorHealth)
            )}
            style={{ width: `${vault.juniorHealth}%` }}
          />
        </div>
      </div>

      {/* ── CTA ─────────────────────────────────────── */}
      <div className="px-4 pb-4">
        <div
          className={cn(
            "w-full py-2.5 rounded-[9px] border text-center",
            "font-display font-semibold text-[12px] tracking-wide",
            "transition-all duration-200",
            isTop
              ? "bg-primary/10 border-primary/30 text-primary group-hover:bg-primary/[0.15] group-hover:border-primary/50"
              : "bg-background/70 border-border/50 text-muted-foreground group-hover:text-foreground group-hover:border-primary/30"
          )}
        >
          View vault →
        </div>
      </div>
    </Link>
  );
};
