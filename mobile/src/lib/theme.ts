export const colors = {
  bg: '#050C0F',
  surface: '#0D1B22',
  surfaceElevated: '#142530',
  surfaceHigh: '#1C3344',
  border: '#1E3340',
  borderStrong: '#2A4A5E',

  text: '#FFFFFF',
  textMuted: '#8AABB5',
  textQuiet: '#4A7080',

  signal: '#00B5A4',
  signalDeep: '#007A6E',
  signalDim: 'rgba(0,181,164,0.12)',
  signalGlow: 'rgba(0,181,164,0.24)',

  danger: '#FB2C36',
  dangerDim: 'rgba(251,44,54,0.12)',

  warning: '#EDB200',
  warningDim: 'rgba(237,178,0,0.12)',

  success: '#00B5A4',

  statusPaper: '#6BA3B0',
  statusActive: '#00B5A4',
  statusCooldown: '#EDB200',
  statusFrozen: '#FB2C36',
  statusClosed: '#555',
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
  sm: 6,
  md: 10,
  lg: 14,
  xl: 20,
  full: 9999,
};

export const font = {
  body: 'System',
  mono: 'Courier',
};

export const textStyles = {
  display: {
    fontSize: 28,
    fontWeight: '700' as const,
    color: colors.text,
    letterSpacing: -0.5,
  },
  heading: {
    fontSize: 20,
    fontWeight: '600' as const,
    color: colors.text,
    letterSpacing: -0.3,
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
  },
  caption: {
    fontSize: 11,
    fontWeight: '500' as const,
    color: colors.textMuted,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.8,
  },
  mono: {
    fontSize: 14,
    fontFamily: 'Courier',
    color: colors.text,
  },
  monoSm: {
    fontSize: 11,
    fontFamily: 'Courier',
    color: colors.textMuted,
  },
};
