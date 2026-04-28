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
  const pnlPercent = ((vault.currentNav - vault.tvl) / vault.tvl) * 100 || 0;
  const isProfitable = pnlPercent >= 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.5 }}
      whileHover={{ y: -4 }}
      className="vc"
    >
      <Link to={`/vault/${vault.id}`} className="block h-full">
        {/* Glow blob */}
        <div
          className="vc-glow"
          style={{
            background: isProfitable ? "rgba(74,222,128,0.08)" : "rgba(248,113,113,0.08)",
          }}
        />

        {/* Head: Avatar, Name, Trader, Status */}
        <div className="vc-head">
          <div className="vc-top">
            <div className="vc-av" style={{ background: `linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary)/0.7))` }}>
              {vault.name.charAt(0).toUpperCase()}
            </div>
            <div className="vc-info">
              <div className="vc-name">{vault.name}</div>
              <div className="vc-addr">{shortAddr(vault.managerPubkey)}</div>
              <div className="vc-tags">
                {vault.status === "active" && <span className="tag t-live">LIVE</span>}
                {juniorPct >= 15 && <span className="tag t-tier">TIER 1</span>}
              </div>
            </div>
            <div className="vc-pnl-wrap">
              <div className={`vc-pnl ${isProfitable ? "up" : "dn"}`}>
                {isProfitable ? "+" : ""}{pnlPercent.toFixed(1)}%
              </div>
              <div className="vc-pnl-lbl">PNL</div>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="vc-div" />

        {/* Stats Grid */}
        <div className="vc-stats">
          <div className="vs">
            <div className="vs-l">TVL</div>
            <div className="vs-v">${fmtUSD(vault.tvl, { compact: true })}</div>
          </div>
          <div className="vs">
            <div className="vs-l">JUNIOR</div>
            <div className="vs-v">{juniorPct}%</div>
          </div>
          <div className="vs">
            <div className="vs-l">SHARPE</div>
            <div className="vs-v up">—</div>
          </div>
        </div>

        {/* Health Bar */}
        <div className="vc-hlth">
          <div className="hl">BUFFER</div>
          <div className="ht">
            <div
              className="hf"
              style={{
                width: `${Math.min(100, vault.juniorHealth)}%`,
                background:
                  vault.juniorHealth > 80
                    ? "hsl(142, 71%, 45%)"
                    : vault.juniorHealth > 50
                      ? "hsl(38, 92%, 50%)"
                      : "hsl(0, 84%, 60%)",
              }}
            />
          </div>
          <div
            className="hp"
            style={{
              color:
                vault.juniorHealth > 80
                  ? "hsl(142, 71%, 45%)"
                  : vault.juniorHealth > 50
                    ? "hsl(38, 92%, 50%)"
                    : "hsl(0, 84%, 60%)",
            }}
          >
            {Math.round(vault.juniorHealth)}%
          </div>
        </div>

        {/* Deposit Button */}
        <div className="vc-foot">
          <button className="dep-btn">
            <span>DEPOSIT</span>
          </button>
        </div>
      </Link>
    </motion.div>
  );
};
