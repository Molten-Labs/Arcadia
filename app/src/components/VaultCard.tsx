import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import type { VaultView } from "@/hooks/useVaults";
import { fmtUSD } from "@/lib/format";
import { StatusBadge } from "./StatusBadge";
import { HealthMeter } from "./HealthMeter";
import { ArrowRight, Zap, TrendingUp } from "lucide-react";
import { shortAddr } from "@/lib/wallet";

export const VaultCard = ({ vault }: { vault: VaultView }) => {
  const juniorPct = vault.tvl > 0 ? Math.round((vault.juniorCapital / vault.tvl) * 100) : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.5 }}
      whileHover={{ y: -8, scale: 1.02 }}
      className="vault-card-group"
    >
      <Link
        to={`/vault/${vault.id}`}
        className="vault-card-wrapper"
        style={{
          background: "rgba(20,25,40,0.4)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          boxShadow: "inset 0 1px 2px rgba(255,255,255,0.05), 0 20px 60px -20px rgba(0,0,0,0.8), 0 0 60px rgba(246,96,169,0.08)",
        }}
      >
        {/* glossy border accent */}
        <div
          className="vault-card-border-accent"
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: "1.5rem",
            padding: "1px",
            background: "linear-gradient(135deg, rgba(255,255,255,0.15), rgba(255,255,255,0.02), rgba(246,96,169,0.1))",
            WebkitMask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
            WebkitMaskComposite: "xor",
            maskComposite: "exclude" as const,
            pointerEvents: "none",
          }}
        />

        {/* animated glow on hover */}
        <div
          className="vault-card-glow absolute inset-0 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"
          style={{
            background: "radial-gradient(circle at 50% 0%, rgba(246,96,169,0.2), transparent 70%)",
            pointerEvents: "none",
          }}
        />

        <div className="relative z-10 flex flex-col gap-4">
          {/* header with manager and status */}
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <motion.h3
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                transition={{ delay: 0.1 }}
                className="vault-card-title"
              >
                {vault.name}
              </motion.h3>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-[11px] text-muted-foreground/70 truncate font-mono">
                  by {shortAddr(vault.managerPubkey)}
                </span>
              </div>
            </div>
            <motion.div whileHover={{ scale: 1.1 }} transition={{ type: "spring", stiffness: 400 }}>
              <StatusBadge status={vault.status} />
            </motion.div>
          </div>

          {/* metrics grid with gradient backgrounds */}
          <div className="grid grid-cols-3 gap-2.5">
            {[
              {
                label: "TVL",
                value: vault.tvl > 0 ? `${fmtUSD(vault.tvl, { compact: true })} SOL` : "—",
              },
              {
                label: "NAV",
                value: vault.currentNav > 0 ? `${fmtUSD(vault.currentNav, { compact: true })} SOL` : "—",
              },
              {
                label: "Junior",
                value: `${juniorPct}%`,
              },
            ].map((metric, i) => (
              <motion.div
                key={metric.label}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 + i * 0.05 }}
                className="vault-metric-box"
              >
                <div className="text-[9px] uppercase tracking-widest text-muted-foreground/60 font-semibold">
                  {metric.label}
                </div>
                <div className="tabular font-semibold text-sm mt-1.5 text-foreground/95">
                  {metric.value}
                </div>
              </motion.div>
            ))}
          </div>

          {/* health meter with enhanced styling */}
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            transition={{ delay: 0.25 }}
            className="py-1"
          >
            <HealthMeter health={vault.juniorHealth} />
          </motion.div>

          {/* feature badges with gradient */}
          <div className="flex flex-wrap gap-1.5">
            {[
              { label: `Fee: ${vault.feeBps / 100}%`, color: "from-blue-500/20 to-blue-600/20" },
              { label: `Slippage: ${vault.maxSlippageBps / 100}%`, color: "from-cyan-500/20 to-blue-500/20" },
            ].map((badge) => (
              <motion.span
                key={badge.label}
                whileHover={{ scale: 1.05 }}
                className={`vault-badge-tag text-[10px] px-2.5 py-1 rounded-full bg-gradient-to-r ${badge.color} text-muted-foreground/80 border border-white/5 backdrop-blur-sm`}
              >
                {badge.label}
              </motion.span>
            ))}
            {vault.instantExit && (
              <motion.span
                whileHover={{ scale: 1.05 }}
                className="vault-badge-feature text-[10px] px-2.5 py-1 rounded-full bg-gradient-to-r from-primary/25 to-primary/15 text-primary/90 border border-primary/30 inline-flex items-center gap-1 backdrop-blur-sm"
              >
                <Zap className="w-2.5 h-2.5" /> Instant exit
              </motion.span>
            )}
          </div>

          {/* footer with status info and CTA */}
          <div className="flex items-center justify-between pt-2 border-t border-white/5">
            <motion.span
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="text-[11px] text-muted-foreground/60"
            >
              {vault.status === "paper" ? (
                <span className="flex items-center gap-1">
                  <TrendingUp className="w-3 h-3" />
                  {vault.paperTradeCount}/{vault.minQualifyingTrades} trades
                </span>
              ) : vault.graduatedAt > 0 ? (
                `Graduated ${new Date(vault.graduatedAt * 1000).toLocaleDateString("en-US", { month: "short", year: "2-digit" })}`
              ) : (
                ""
              )}
            </motion.span>
            <motion.span
              whileHover={{ gap: "0.75rem" }}
              className="text-xs text-primary/80 inline-flex items-center gap-1 font-semibold group-hover:text-primary transition-colors"
            >
              View vault <ArrowRight className="w-3 h-3" />
            </motion.span>
          </div>
        </div>
      </Link>
    </motion.div>
  );
};
