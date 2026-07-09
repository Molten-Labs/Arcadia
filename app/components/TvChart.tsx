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

// Read an acid token from the :root mirror. lightweight-charts renders to a
// canvas and cannot resolve var(), so we resolve concrete strings at runtime
// with literal fallbacks that match the acid palette.
function readToken(name: string, fallback: string): string {
  if (typeof document === "undefined") return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

// Append an alpha channel to a 6-digit hex color, yielding 8-digit hex.
function withAlpha(hex: string, alpha: number): string {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return hex;
  const a = Math.round(Math.max(0, Math.min(1, alpha)) * 255)
    .toString(16)
    .padStart(2, "0");
  return `${hex}${a}`;
}

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
  externalCandles?: { time: number; open: number; high: number; low: number; close: number }[];
}

export function TvChart({ market, currentPrice, height = 360, fullHeight = false, positions = [], externalCandles }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const priceLinesRef = useRef<Map<string, IPriceLine>>(new Map());

  const candles = useMemo(() => {
    if (externalCandles && externalCandles.length > 0) {
      // setData asserts on non-ascending times: normalize ms -> s, sort,
      // and drop duplicate timestamps (keep the latest update for a bucket).
      const bySecond = new Map<number, CandlestickData>();
      for (const c of externalCandles) {
        const t = c.time > 1e12 ? Math.floor(c.time / 1000) : c.time;
        bySecond.set(t, { time: t as Time, open: c.open, high: c.high, low: c.low, close: c.close });
      }
      return [...bySecond.values()].sort((a, b) => (a.time as number) - (b.time as number));
    }
    return generateCandles(market, SEED_PRICES[market] ?? 100);
  }, [market, externalCandles]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Resolve acid tokens once at chart-creation time (canvas needs literals).
    const panel   = readToken("--color-panel",   "#0d0d14");
    const line    = readToken("--color-line",    "#1c1c1c");
    const faint   = readToken("--color-faint",   "#5C6470");
    const panel2  = readToken("--color-panel-2", "#14141c");
    const acid    = readToken("--color-acid",    "#CCFF00");
    const success = readToken("--color-success", "#34E29B");
    const danger  = readToken("--color-danger",  "#FF3B6B");
    const crosshair = withAlpha(acid, 0.4);

    // Snapshot the price-line map this effect owns so cleanup uses a stable ref.
    const priceLines = priceLinesRef.current;

    const resolvedHeight = fullHeight
      ? (container.clientHeight || 400)
      : height;

    const chart = createChart(container, {
      layout: {
        background: { type: ColorType.Solid, color: panel },
        textColor: faint,
        fontSize: 11,
        fontFamily: "'Space Mono', ui-monospace, 'Menlo', monospace",
      },
      grid: {
        vertLines: { color: line, style: 1 },
        horzLines: { color: line, style: 1 },
      },
      crosshair: {
        mode: CrosshairMode.Magnet,
        vertLine: { color: crosshair, labelBackgroundColor: panel2 },
        horzLine: { color: crosshair, labelBackgroundColor: panel2 },
      },
      timeScale: {
        borderColor: line,
        timeVisible: true,
        secondsVisible: false,
        fixLeftEdge: false,
        lockVisibleTimeRangeOnResize: true,
      },
      rightPriceScale: {
        borderColor: line,
        scaleMargins: { top: 0.1, bottom: 0.1 },
      },
      handleScroll: { mouseWheel: true, pressedMouseMove: true },
      handleScale: { mouseWheel: true, pinch: true },
      width: container.clientWidth,
      height: resolvedHeight,
    });

    const series = chart.addSeries(CandlestickSeries, {
      upColor: success,
      downColor: danger,
      borderUpColor: success,
      borderDownColor: danger,
      wickUpColor: withAlpha(success, 0.5),
      wickDownColor: withAlpha(danger, 0.5),
    });

    series.setData(candles);
    chart.timeScale().fitContent();

    chartRef.current = chart;
    seriesRef.current = series;
    priceLines.clear();

    const ro = new ResizeObserver(() => {
      if (containerRef.current) {
        const newH = fullHeight
          ? (containerRef.current.clientHeight || 400)
          : height;
        chart.applyOptions({ width: containerRef.current.clientWidth, height: newH });
      }
    });
    ro.observe(container);

    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
      priceLines.clear();
    };
  }, [candles, height, fullHeight]);

  // Sync price lines with open positions
  useEffect(() => {
    const series = seriesRef.current;
    if (!series) return;

    const longColor  = readToken("--color-success", "#34E29B");
    const shortColor = readToken("--color-danger",  "#FF3B6B");

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
        const color = isLong ? longColor : shortColor;
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
