import { useMemo } from "react";

interface Candle { o: number; h: number; l: number; c: number; }

const generate = (count: number, start = 180): Candle[] => {
  const out: Candle[] = [];
  let price = start;
  for (let i = 0; i < count; i++) {
    const o = price;
    const change = (Math.sin(i * 0.5) + (Math.random() - 0.5)) * 4;
    const c = Math.max(50, o + change);
    const h = Math.max(o, c) + Math.random() * 2;
    const l = Math.min(o, c) - Math.random() * 2;
    out.push({ o, h, l, c });
    price = c;
  }
  return out;
};

export const CandlestickChart = ({ count = 48, height = 240 }: { count?: number; height?: number }) => {
  const candles = useMemo(() => generate(count), [count]);
  const min = Math.min(...candles.map(c => c.l));
  const max = Math.max(...candles.map(c => c.h));
  const range = max - min || 1;
  const cw = 100 / count;

  return (
    <div className="w-full" style={{ height }}>
      <svg viewBox={`0 0 100 100`} preserveAspectRatio="none" className="w-full h-full">
        {/* gridlines */}
        {[0, 25, 50, 75, 100].map(y => (
          <line key={y} x1={0} x2={100} y1={y} y2={y} stroke="hsl(var(--border))" strokeWidth={0.1} strokeOpacity={0.5} />
        ))}
        {candles.map((c, i) => {
          const x = i * cw + cw / 2;
          const yH = ((max - c.h) / range) * 100;
          const yL = ((max - c.l) / range) * 100;
          const yO = ((max - c.o) / range) * 100;
          const yC = ((max - c.c) / range) * 100;
          const up = c.c >= c.o;
          const color = up ? "hsl(var(--success))" : "hsl(var(--destructive))";
          return (
            <g key={i}>
              <line x1={x} x2={x} y1={yH} y2={yL} stroke={color} strokeWidth={0.15} />
              <rect
                x={x - cw * 0.35}
                y={Math.min(yO, yC)}
                width={cw * 0.7}
                height={Math.max(0.4, Math.abs(yC - yO))}
                fill={color}
                opacity={up ? 0.9 : 0.85}
              />
            </g>
          );
        })}
      </svg>
    </div>
  );
};
