export const colors = {
  bg: '#F8FBFA',
  surface: '#FFFFFF',
  surfaceElevated: '#EEF6F5',
  surfaceHigh: '#DCEBE9',
  border: '#D7E7E5',
  borderStrong: '#A8C7C2',

  text: '#002B3D',
  textMuted: '#4A7080',
  textQuiet: '#7FA0A8',

  signal: '#007A6E',
  signalDeep: '#005A52',
  signalDim: 'rgba(0,122,110,0.10)',
  signalGlow: 'rgba(0,181,164,0.22)',

  danger: '#EF4444',
  dangerDim: 'rgba(239,68,68,0.12)',

  warning: '#F59E0B',
  warningDim: 'rgba(245,158,11,0.12)',

  success: '#007A6E',

  statusPaper: '#6B8790',
  statusActive: '#007A6E',
  statusCooldown: '#F59E0B',
  statusFrozen: '#EF4444',
  statusClosed: '#8AABB5',

  ink: '#07191C',
  inkSurface: '#0E2328',
  inkSurfaceElevated: '#143137',
  inkBorder: '#244A51',
  white: '#FFFFFF',
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
  md: 10,
  lg: 12,
  xl: 16,
  card: 14,
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
