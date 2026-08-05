"use client";

import { useEffect, useRef, useMemo, useState } from "react";
import {
  createChart,
  CandlestickSeries,
  HistogramSeries,
  LineSeries,
  createSeriesMarkers,
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
  LineData,
  HistogramData,
  SeriesMarker,
  MouseEventParams,
  ISeriesMarkersPluginApi,
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

// Simple moving average aligned to bar index; warm-up points omitted so the
// line simply starts once the period is covered.
function sma(candles: CandlestickData[], period: number): LineData[] {
  const out: LineData[] = [];
  let sum = 0;
  for (let i = 0; i < candles.length; i++) {
    sum += candles[i].close;
    if (i >= period) sum -= candles[i - period].close;
    if (i >= period - 1) {
      out.push({ time: candles[i].time, value: sum / period });
    }
  }
  return out;
}

// Exponential moving average, seeded from the first close.
function ema(candles: CandlestickData[], period: number): LineData[] {
  const k = 2 / (period + 1);
  const out: LineData[] = [];
  let prev: number | null = null;
  for (const c of candles) {
    const v: number =
      prev === null ? c.close : c.close * k + (prev as number) * (1 - k);
    prev = v;
    out.push({ time: c.time, value: v });
  }
  return out;
}

export interface PositionMarker {
  id: string;
  direction: "long" | "short";
  entry_px: number;
  size_usd: number;
  leverage: number;
}

export type ChartTool = "crosshair" | "hline" | "marker";

type CandleWithVolume = CandlestickData & { volume: number };

interface Props {
  market: string;
  currentPrice?: number;
  height?: number;
  fullHeight?: boolean;
  positions?: PositionMarker[];
  accountPnl?: number;
  showVolume?: boolean;
  showMA?: boolean;
  showEMA?: boolean;
  tool?: ChartTool;
  clearKey?: number;
  externalCandles?: { time: number; open: number; high: number; low: number; close: number; volume?: number }[];
}

interface Legend {
  time: Time;
  open: number;
  high: number;
  low: number;
  close: number;
}

export function TvChart({
  market,
  currentPrice,
  height = 360,
  fullHeight = false,
  positions = [],
  accountPnl,
  showVolume = false,
  showMA = false,
  showEMA = false,
  tool = "crosshair",
  clearKey = 0,
  externalCandles,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const maRef = useRef<ISeriesApi<"Line"> | null>(null);
  const emaRef = useRef<ISeriesApi<"Line"> | null>(null);
  const markersRef = useRef<ISeriesMarkersPluginApi<Time> | null>(null);
  const priceLinesRef = useRef<Map<string, IPriceLine>>(new Map());
  const hlinesRef = useRef<IPriceLine[]>([]);
  const toolRef = useRef<ChartTool>(tool);
  const clearKeyRef = useRef(clearKey);
  const [hoverLegend, setHoverLegend] = useState<Legend | null>(null);

  useEffect(() => {
    toolRef.current = tool;
  }, [tool]);
  useEffect(() => {
    clearKeyRef.current = clearKey;
  }, [clearKey]);

  const candles = useMemo(() => {
    // Real candles only. With no feed this stays empty so the terminal never
    // draws fabricated history — the page's loading state covers the gap.
    if (externalCandles && externalCandles.length > 0) {
      const bySecond = new Map<number, CandleWithVolume>();
      for (const c of externalCandles) {
        const t = c.time > 1e12 ? Math.floor(c.time / 1000) : c.time;
        bySecond.set(t, { time: t as Time, open: c.open, high: c.high, low: c.low, close: c.close, volume: c.volume ?? 0 });
      }
      return [...bySecond.values()].sort((a, b) => (a.time as number) - (b.time as number));
    }
    return [];
  }, [externalCandles]);

  // ── Chart is created ONCE on mount; data flows in via effects so the chart
  //    (and any drawings/indicators) survive candle polls.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const panel   = readToken("--color-panel",   "#0d0d14");
    const line    = readToken("--color-line",    "#1c1c1c");
    const faint   = readToken("--color-faint",   "#5C6470");
    const panel2  = readToken("--color-panel-2", "#14141c");
    const acid    = readToken("--color-acid",    "#CCFF00");
    const success = readToken("--color-success", "#34E29B");
    const danger  = readToken("--color-danger",  "#FF3B6B");
    const crosshair = withAlpha(acid, 0.4);

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
    ro.observe(container);

    const priceLines = priceLinesRef.current;

    return () => {
      ro.disconnect();
      priceLines.clear();
      hlinesRef.current = [];
      markersRef.current = null;
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
      volumeRef.current = null;
      maRef.current = null;
      emaRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chart must be created once
  }, []);

  // ── Candles + indicator data ──────────────────────────────────────────
  const fittedRef = useRef(false);
  useEffect(() => {
    const series = seriesRef.current;
    if (!series) return;
    series.setData(candles);
    // Fit only on first data or market switch, not on every live poll, so we
    // don't fight the user's pan/zoom.
    if (candles.length > 0 && !fittedRef.current) {
      fittedRef.current = true;
      chartRef.current?.timeScale().fitContent();
    }
  }, [candles]);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || !seriesRef.current) return;
    const volume = volumeRef.current;
    if (showVolume) {
      if (!volume) {
        const v = chart.addSeries(HistogramSeries, {
          priceFormat: { type: "volume" },
          priceScaleId: "vol",
          lastValueVisible: false,
          priceLineVisible: false,
        });
        chart.priceScale("vol").applyOptions({ scaleMargins: { top: 0.85, bottom: 0 } });
        volumeRef.current = v;
      }
      const up = withAlpha(readToken("--color-success", "#34E29B"), 0.55);
      const down = withAlpha(readToken("--color-danger", "#FF3B6B"), 0.55);
      const data: HistogramData[] = candles.map((c) => ({
        time: c.time,
        value: c.volume,
        color: c.close >= c.open ? up : down,
      }));
      volumeRef.current?.setData(data);
      volumeRef.current?.applyOptions({ visible: true });
    } else if (volume) {
      volume.applyOptions({ visible: false });
    }
  }, [showVolume, candles]);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || !seriesRef.current) return;
    const ma = maRef.current;
    if (showMA) {
      if (!ma) {
        const m = chart.addSeries(LineSeries, {
          color: readToken("--color-acid", "#CCFF00"),
          lineWidth: 1,
          priceLineVisible: false,
          lastValueVisible: false,
          crosshairMarkerVisible: false,
        });
        maRef.current = m;
      }
      maRef.current?.setData(sma(candles, 20));
      maRef.current?.applyOptions({ visible: true });
    } else if (ma) {
      ma.applyOptions({ visible: false });
    }
  }, [showMA, candles]);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || !seriesRef.current) return;
    const e = emaRef.current;
    if (showEMA) {
      if (!e) {
        const m = chart.addSeries(LineSeries, {
          color: readToken("--color-faint", "#5C6470"),
          lineWidth: 1,
          lineStyle: LineStyle.Dotted,
          priceLineVisible: false,
          lastValueVisible: false,
          crosshairMarkerVisible: false,
        });
        emaRef.current = m;
      }
      emaRef.current?.setData(ema(candles, 20));
      emaRef.current?.applyOptions({ visible: true });
    } else if (e) {
      e.applyOptions({ visible: false });
    }
  }, [showEMA, candles]);

  // ── Sync price lines with open positions (existing behaviour) ────────
  useEffect(() => {
    const series = seriesRef.current;
    if (!series) return;

    const longColor  = readToken("--color-success", "#34E29B");
    const shortColor = readToken("--color-danger",  "#FF3B6B");

    const existing = priceLinesRef.current;
    const activeIds = new Set(positions.map((p) => p.id));

    for (const [id, line] of existing) {
      if (!activeIds.has(id)) {
        try { series.removePriceLine(line); } catch { /* already removed */ }
        existing.delete(id);
      }
    }

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

  // ── Live-tick: update the last candle's close/high/low ───────────────
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

  // ── OHLC legend (crosshair + resting state) ──────────────────────────
  useEffect(() => {
    const chart = chartRef.current;
    const series = seriesRef.current;
    if (!chart || !series) return;

    const onMove = (p: MouseEventParams) => {
      const bar = p.seriesData.get(series) as
        | { open: number; high: number; low: number; close: number }
        | undefined;
      if (bar && p.time !== undefined) {
        setHoverLegend({ time: p.time as Time, open: bar.open, high: bar.high, low: bar.low, close: bar.close });
      } else {
        setHoverLegend(null);
      }
    };
    chart.subscribeCrosshairMove(onMove);
    return () => chart.unsubscribeCrosshairMove(onMove);
  }, []);

  // ── Drawing tools: horizontal line + marker ──────────────────────────
  useEffect(() => {
    const chart = chartRef.current;
    const series = seriesRef.current;
    if (!chart || !series) return;

    const onClick = (p: MouseEventParams) => {
      const t = toolRef.current;
      if (t === "crosshair" || !p.point || p.time === undefined) return;

      if (t === "hline") {
        const price = series.coordinateToPrice(p.point.y);
        if (price == null) return;
        const color = readToken("--color-acid", "#CCFF00");
        const hl = series.createPriceLine({
          price,
          color: withAlpha(color, 0.7),
          lineWidth: 1,
          lineStyle: LineStyle.Solid,
          axisLabelVisible: true,
          title: price.toFixed(2),
        });
        hlinesRef.current.push(hl);
      } else if (t === "marker") {
        const bar = p.seriesData.get(series) as
          | { open: number; high: number; low: number; close: number }
          | undefined;
        if (!bar) return;
        const color = bar.close >= bar.open
          ? readToken("--color-success", "#34E29B")
          : readToken("--color-danger", "#FF3B6B");
        const marker: SeriesMarker<Time> = {
          time: p.time as Time,
          position: "inBar",
          shape: "arrowUp",
          color,
          text: "@",
        };
        if (!markersRef.current) {
          markersRef.current = createSeriesMarkers(series, [marker]);
        } else {
          markersRef.current.setMarkers([...(markersRef.current.markers() as SeriesMarker<Time>[]), marker]);
        }
      }
    };
    chart.subscribeClick(onClick);
    return () => chart.unsubscribeClick(onClick);
  }, []);

  // ── Clear drawings when clearKey changes ─────────────────────────────
  useEffect(() => {
    const series = seriesRef.current;
    if (!series) return;
    for (const hl of hlinesRef.current) {
      try { series.removePriceLine(hl); } catch { /* already removed */ }
    }
    hlinesRef.current = [];
    markersRef.current?.setMarkers([]);
  }, [clearKey]);

  // Resting legend = last candle (live); crosshair hover overrides it.
  const restingLegend: Legend | undefined = candles.length > 0
    ? { time: candles[candles.length - 1].time, open: candles[candles.length - 1].open, high: candles[candles.length - 1].high, low: candles[candles.length - 1].low, close: candles[candles.length - 1].close }
    : undefined;
  const legend = hoverLegend ?? restingLegend;
  const isUp = legend ? legend.close >= legend.open : true;

  return (
    <div className="relative w-full" style={{ height: fullHeight ? "100%" : height }}>
      <div ref={containerRef} className="absolute inset-0" />
      {legend && (
        <div className="pointer-events-none absolute top-0 left-0 z-10 flex items-center gap-3 rounded-bl-lg bg-panel/70 px-2 py-1 font-mono text-[10px] tabular-nums backdrop-blur-sm">
          <span className="font-bold text-ink">
            {market}
          </span>
          <span>
            <span className="text-faint">O</span>{" "}
            <span style={{ color: legend.open >= legend.close ? "var(--color-danger)" : "var(--color-success)" }}>
              {legend.open.toFixed(2)}
            </span>
          </span>
          <span>
            <span className="text-faint">H</span>{" "}
            <span className="text-ink">{legend.high.toFixed(2)}</span>
          </span>
          <span>
            <span className="text-faint">L</span>{" "}
            <span className="text-ink">{legend.low.toFixed(2)}</span>
          </span>
          <span>
            <span className="text-faint">C</span>{" "}
            <span style={{ color: isUp ? "var(--color-success)" : "var(--color-danger)" }}>
              {legend.close.toFixed(2)}
            </span>
          </span>
          {accountPnl !== undefined && (
            <span className="border-l border-line pl-2">
              <span className="text-faint">PnL</span>{" "}
              <span style={{ color: accountPnl >= 0 ? "var(--color-success)" : "var(--color-danger)" }}>
                {accountPnl >= 0 ? "+" : ""}{accountPnl.toFixed(2)}
              </span>
            </span>
          )}
        </div>
      )}
    </div>
  );
}