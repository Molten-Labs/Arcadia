"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useWallet } from "@solana/wallet-adapter-react";
import dynamic from "next/dynamic";
import { Wallet } from "lucide-react";

import { PaperTradeMarketBar, fmtPx } from "@/components/pages/trader/PaperTradeMarketBar";
import { PaperTradeOrderForm } from "@/components/pages/trader/PaperTradeOrderForm";
import { PaperTradePositions } from "@/components/pages/trader/PaperTradePositions";
import type { Direction } from "@/components/pages/trader/terminal-types";
import { EnvChip, MicroLabel, PageHeader } from "@/components/pages/trader/trader-ui";
import { WalletButton } from "@/components/shell/WalletButton";
import { apiFetch } from "@/lib/utils";
import type { OpenPosition, PriceData } from "@/lib/types";

const TvChart = dynamic(() => import("@/components/TvChart").then((m) => m.TvChart), {
  ssr: false,
});

const MARKETS = ["SOL-PERP", "BTC-PERP", "ETH-PERP", "ARB-PERP"];

export default function TradePage() {
  const { connected } = useWallet();
  const [market, setMarket] = useState("SOL-PERP");
  const [direction, setDirection] = useState<Direction>("long");
  const [sizeUSD, setSizeUSD] = useState("1000");
  const [leverage, setLeverage] = useState(3);
  const [positions, setPositions] = useState<OpenPosition[]>([]);
  const [closingId, setClosingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Wall-clock captured only inside effect callbacks so opened_at can be read in
  // the event handler without calling Date.now() during render (keeps
  // react-hooks/purity clean without an eslint-disable).
  const nowRef = useRef(0);

  const { data: prices } = useQuery<PriceData[]>({
    queryKey: ["prices"],
    queryFn: () => apiFetch("/prices"),
    refetchInterval: 3000,
  });

  const currentPrice = prices?.find((p) => p.market === market);

  // Recompute simulated uPnL from the latest polled prices on a fixed cadence.
  useEffect(() => {
    nowRef.current = Date.now();
    const interval = setInterval(() => {
      nowRef.current = Date.now();
      setPositions((prev) =>
        prev.map((pos) => {
          const price = prices?.find((p) => p.market === pos.market)?.price ?? pos.entry_px;
          const upnl =
            pos.direction === "long"
              ? (pos.size_usd * pos.leverage * (price - pos.entry_px)) / pos.entry_px
              : (pos.size_usd * pos.leverage * (pos.entry_px - price)) / pos.entry_px;
          return { ...pos, upnl };
        }),
      );
    }, 3000);
    return () => clearInterval(interval);
  }, [prices]);

  const openPosition = () => {
    if (!connected || !currentPrice) return;
    const newPos: OpenPosition = {
      id: crypto.randomUUID(),
      market,
      direction,
      size_usd: parseFloat(sizeUSD) || 1000,
      leverage,
      entry_px: currentPrice.price,
      opened_at: Math.floor(nowRef.current / 1000),
      upnl: 0,
    };
    setSubmitting(true);
    setTimeout(() => {
      setPositions((prev) => [newPos, ...prev]);
      setSubmitting(false);
    }, 600);
  };

  const closePosition = (id: string) => {
    setClosingId(id);
    setTimeout(() => {
      setPositions((prev) => prev.filter((p) => p.id !== id));
      setClosingId(null);
    }, 1200);
  };

  if (!connected) {
    return (
      <div className="grid min-h-[70vh] place-items-center bg-void px-5">
        <div className="max-w-sm rounded-2xl border border-white/10 bg-panel p-10 text-center">
          <div className="mx-auto mb-5 grid size-14 place-items-center rounded-full border border-acid/25 bg-acid/10">
            <Wallet size={24} className="text-acid" />
          </div>
          <p className="mb-2 text-base font-semibold text-ink">Connect wallet to paper trade</p>
          <p className="mb-6 text-sm text-faint">
            Paper trading on Solana devnet. Simulated fills, no real capital at risk.
          </p>
          <div className="flex justify-center">
            <WalletButton />
          </div>
        </div>
      </div>
    );
  }

  const changePct = currentPrice?.change_pct_24h ?? 0;
  const up = changePct >= 0;

  return (
    <div className="min-h-full bg-void">
      <div className="mx-auto max-w-7xl px-4 py-8">
        <PageHeader title="Paper Trade">
          <EnvChip live>Solana devnet - simulated fills - no real capital</EnvChip>
        </PageHeader>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
          {/* Order ticket */}
          <div className="lg:col-span-1">
            <PaperTradeOrderForm
              markets={MARKETS}
              market={market}
              setMarket={setMarket}
              direction={direction}
              setDirection={setDirection}
              sizeUSD={sizeUSD}
              setSizeUSD={setSizeUSD}
              leverage={leverage}
              setLeverage={setLeverage}
              currentPrice={currentPrice?.price}
              onSubmit={openPosition}
              submitting={submitting}
              connected={connected}
            />
          </div>

          {/* Market bar + chart + positions */}
          <div className="space-y-6 lg:col-span-3">
            <PaperTradeMarketBar prices={prices} market={market} setMarket={setMarket} />

            <div className="overflow-hidden rounded-2xl border border-white/10 bg-panel">
              <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
                <div className="flex items-center gap-3">
                  <MicroLabel>{market}</MicroLabel>
                  {currentPrice && (
                    <>
                      <span className="font-mono text-sm font-bold tabular-nums text-ink">
                        {fmtPx(market, currentPrice.price)}
                      </span>
                      <span
                        className={`font-mono text-xs font-semibold tabular-nums ${
                          up ? "text-success" : "text-danger"
                        }`}
                      >
                        {up ? "+" : ""}
                        {changePct.toFixed(2)}%
                      </span>
                    </>
                  )}
                </div>
                <span className="rounded border border-white/10 bg-panel-2 px-2 py-0.5 font-mono text-[0.62rem] tracking-[0.14em] text-faint uppercase">
                  15m
                </span>
              </div>
              <TvChart
                market={market}
                currentPrice={currentPrice?.price}
                height={360}
                positions={positions
                  .filter((p) => p.market === market)
                  .map((p) => ({
                    id: p.id,
                    direction: p.direction,
                    entry_px: p.entry_px,
                    size_usd: p.size_usd,
                    leverage: p.leverage,
                  }))}
              />
            </div>

            <PaperTradePositions
              positions={positions}
              prices={prices}
              closingId={closingId}
              onClose={closePosition}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
