export function formatUSD(n: number, compact = false): string {
  if (compact) {
    if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  }
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export function formatPct(n: number, decimals = 1): string {
  return `${(n * 100).toFixed(decimals)}%`;
}

export function formatBps(bps: number): string {
  return `${(bps / 100).toFixed(2)}%`;
}

export function truncateAddress(addr: string, chars = 4): string {
  if (!addr || addr.length < chars * 2 + 3) return addr;
  return `${addr.slice(0, chars)}…${addr.slice(-chars)}`;
}

export function formatNav(nav: number): string {
  return nav.toFixed(4);
}

export function formatAge(ts: number): string {
  const diff = Math.floor(Date.now() / 1000) - ts;
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  const d = Math.floor(diff / 86400);
  return `${d}d`;
}

export function formatPnL(deposited: number, current: number): string {
  const diff = current - deposited;
  const sign = diff >= 0 ? '+' : '';
  return `${sign}${formatUSD(diff, true)}`;
}

export function pnlColor(deposited: number, current: number, colors: { signal: string; danger: string; textMuted: string }): string {
  const diff = current - deposited;
  if (diff > 0) return colors.signal;
  if (diff < 0) return colors.danger;
  return colors.textMuted;
}
