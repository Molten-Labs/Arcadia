"use client";

import { useEffect, useRef, useMemo } from "react";
import {
  createChart,
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  LineStyle,
} from "lightweight-charts";
import type {
  IChartApi,
  ISeriesApi,
  CandlestickData,
  IPriceLine,
  Time,
} from "lightweight-charts";

const SEED_PRICES: Record<string, number> = {
  "SOL-PERP": 152.4,
  "BTC-PERP": 67420,
  "ETH-PERP": 3488,
  "ARB-PERP": 1.22,
};

function generateCandles(market: string, basePrice: number, count = 150): CandlestickData[] {
  const now = Math.floor(Date.now() / 1000);
  const intervalSecs = 900;
  const candles: CandlestickData[] = [];
  let price = basePrice * (0.88 + (market.charCodeAt(0) % 7) * 0.004);
  const volatility = basePrice * 0.006;

  for (let i = count - 1; i >= 0; i--) {
    const time = (now - i * intervalSecs) as Time;
    const open = price;
    const drift = (Math.random() - 0.47) * volatility;
    const close = Math.max(open + drift, basePrice * 0.5);
    const wick = volatility * 0.4;
    const high = Math.max(open, close) + Math.random() * wick;
    const low = Math.min(open, close) - Math.random() * wick;
    candles.push({ time, open, high, low, close });
    price = close;
  }
  return candles;
}

export interface PositionMarker {
  id: string;
  direction: "long" | "short";
  entry_px: number;
  size_usd: number;
  leverage: number;
}

interface Props {
  market: string;
  currentPrice?: number;
  height?: number;
  fullHeight?: boolean;
  positions?: PositionMarker[];
}

export function TvChart({ market, currentPrice, height = 360, fullHeight = false, positions = [] }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const priceLinesRef = useRef<Map<string, IPriceLine>>(new Map());

  const candles = useMemo(
    () => generateCandles(market, SEED_PRICES[market] ?? 100),
    [market],
  );

  useEffect(() => {
    if (!containerRef.current) return;

    const resolvedHeight = fullHeight
      ? (containerRef.current.clientHeight || 400)
      : height;

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "#11151a" },
        textColor: "#6b7280",
        fontSize: 11,
        fontFamily: "'JetBrains Mono', 'Menlo', monospace",
      },
      grid: {
        vertLines: { color: "#1a2030", style: 1 },
        horzLines: { color: "#1a2030", style: 1 },
      },
      crosshair: {
        mode: CrosshairMode.Magnet,
        vertLine: { color: "#27c08a55", labelBackgroundColor: "#1a5f4a" },
        horzLine: { color: "#27c08a55", labelBackgroundColor: "#1a5f4a" },
      },
      timeScale: {
        borderColor: "#1e2530",
        timeVisible: true,
        secondsVisible: false,
        fixLeftEdge: false,
        lockVisibleTimeRangeOnResize: true,
      },
      rightPriceScale: {
        borderColor: "#1e2530",
        scaleMargins: { top: 0.1, bottom: 0.1 },
      },
      handleScroll: { mouseWheel: true, pressedMouseMove: true },
      handleScale: { mouseWheel: true, pinch: true },
      width: containerRef.current.clientWidth,
      height: resolvedHeight,
    });

    const series = chart.addSeries(CandlestickSeries, {
      upColor: "#27c08a",
      downColor: "#ff5c6c",
      borderUpColor: "#27c08a",
      borderDownColor: "#ff5c6c",
      wickUpColor: "#27c08a80",
      wickDownColor: "#ff5c6c80",
    });

    series.setData(candles);
    chart.timeScale().fitContent();

    chartRef.current = chart;
    seriesRef.current = series;
    priceLinesRef.current.clear();

    const ro = new ResizeObserver(() => {
      if (containerRef.current) {
        const newH = fullHeight
          ? (containerRef.current.clientHeight || 400)
          : height;
        chart.applyOptions({ width: containerRef.current.clientWidth, height: newH });
      }
    });
    ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
      priceLinesRef.current.clear();
    };
  }, [candles, height, fullHeight]);

  // Sync price lines with open positions
  useEffect(() => {
    const series = seriesRef.current;
    if (!series) return;

    const existing = priceLinesRef.current;
    const activeIds = new Set(positions.map((p) => p.id));

    // Remove lines for closed positions
    for (const [id, line] of existing) {
      if (!activeIds.has(id)) {
        try { series.removePriceLine(line); } catch { /* already removed */ }
        existing.delete(id);
      }
    }

    // Add lines for new positions
    for (const pos of positions) {
      if (!existing.has(pos.id)) {
        const isLong = pos.direction === "long";
        const color = isLong ? "#27c08a" : "#ff5c6c";
        const label = `${isLong ? "▲ LONG" : "▼ SHORT"} ${pos.leverage}x · $${pos.size_usd.toLocaleString()}`;

        const line = series.createPriceLine({
          price: pos.entry_px,
          color,
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: true,
          title: label,
        });
        existing.set(pos.id, line);
      }
    }
  }, [positions]);

  // Live-tick: update the last candle's close/high/low
  useEffect(() => {
    if (!seriesRef.current || currentPrice == null || candles.length === 0) return;
    const last = candles[candles.length - 1];
    seriesRef.current.update({
      time: last.time,
      open: last.open,
      high: Math.max(last.high, currentPrice),
      low: Math.min(last.low, currentPrice),
      close: currentPrice,
    });
  }, [currentPrice, candles]);

  return (
    <div
      ref={containerRef}
      style={{ width: "100%", height: fullHeight ? "100%" : height }}
      className="overflow-hidden"
    />
  );
}
