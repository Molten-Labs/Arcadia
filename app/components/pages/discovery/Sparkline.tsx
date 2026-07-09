const SANITIZE = /[^a-z0-9]/gi;

/**
 * Tiny deterministic sparkline. Shape is derived from `seed` (no randomness, so
 * it is SSR-stable). Colour comes from tokens: acid when positive, danger when
 * negative.
 */
export function Sparkline({
  seed,
  positive,
  uid,
  width = 72,
  height = 24,
}: {
  seed: number;
  positive: boolean;
  uid: string;
  width?: number;
  height?: number;
}) {
  const pts = Array.from({ length: 12 }, (_, i) => {
    const noise = Math.sin((seed + i) * 2.5) * 0.4 + Math.sin((seed + i) * 1.1) * 0.3;
    return 30 + noise * 20 + (positive ? i * 1.2 : -i * 0.5);
  });
  const min = Math.min(...pts);
  const max = Math.max(...pts);
  const range = max - min || 1;
  const coords = pts.map((v, i) => ({
    x: (i / (pts.length - 1)) * width,
    y: height - ((v - min) / range) * height,
  }));
  const path = coords
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(" ");
  const areaPath = `${path} L ${width} ${height} L 0 ${height} Z`;
  const stroke = positive ? "var(--color-acid)" : "var(--color-danger)";
  const gradId = `spark-${uid.replace(SANITIZE, "_")}`;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      fill="none"
      aria-hidden
      style={{ overflow: "visible" }}
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.28" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#${gradId})`} />
      <path
        d={path}
        stroke={stroke}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}
