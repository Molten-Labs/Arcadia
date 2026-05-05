export const colors = {
  bg: '#0C0C0E',
  surface: '#18181B',
  surfaceElevated: '#1C1C1F',
  surfaceHigh: '#27272A',
  border: '#27272A',
  borderStrong: '#3F3F46',

  text: '#FFFFFF',
  textMuted: '#A1A1AA',
  textQuiet: '#52525B',

  signal: '#A3E635',
  signalDeep: '#84CC16',
  signalDim: 'rgba(163,230,53,0.10)',
  signalGlow: 'rgba(163,230,53,0.22)',

  danger: '#EF4444',
  dangerDim: 'rgba(239,68,68,0.12)',

  warning: '#F59E0B',
  warningDim: 'rgba(245,158,11,0.12)',

  success: '#A3E635',

  statusPaper: '#71717A',
  statusActive: '#A3E635',
  statusCooldown: '#F59E0B',
  statusFrozen: '#EF4444',
  statusClosed: '#3F3F46',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  card: 24,
  pill: 9999,
  full: 9999,
};

export const font = {
  body: 'System',
  mono: 'Courier',
};

export const textStyles = {
  display: {
    fontSize: 40,
    fontWeight: '500' as const,
    color: colors.text,
    letterSpacing: -1,
    fontFamily: 'System',
  },
  heading: {
    fontSize: 22,
    fontWeight: '600' as const,
    color: colors.text,
    letterSpacing: -0.4,
  },
  subheading: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: colors.text,
  },
  body: {
    fontSize: 14,
    fontWeight: '400' as const,
    color: colors.text,
    lineHeight: 22,
  },
  caption: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: colors.textMuted,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.8,
    fontFamily: 'Courier',
  },
  mono: {
    fontSize: 14,
    fontFamily: 'Courier',
    fontWeight: '600' as const,
    color: colors.text,
  },
  monoSm: {
    fontSize: 11,
    fontFamily: 'Courier',
    fontWeight: '600' as const,
    color: colors.textMuted,
  },
};
