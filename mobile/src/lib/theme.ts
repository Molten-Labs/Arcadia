export const colors = {
  bg: '#07101A',
  surface: '#0D1B27',
  surfaceElevated: '#13243A',
  surfaceHigh: '#1A3050',
  border: '#1D2E40',
  borderStrong: '#2A4560',

  text: '#DCF0F8',
  textMuted: '#6A90A8',
  textQuiet: '#3D607A',

  signal: '#00C896',
  signalDeep: '#00A07A',
  signalDim: 'rgba(0,200,150,0.10)',
  signalGlow: 'rgba(0,200,150,0.24)',

  danger: '#FF5555',
  dangerDim: 'rgba(255,85,85,0.12)',

  warning: '#F5A623',
  warningDim: 'rgba(245,166,35,0.12)',

  success: '#00C896',

  statusPaper: '#5A7A8A',
  statusActive: '#00C896',
  statusCooldown: '#F5A623',
  statusFrozen: '#FF5555',
  statusClosed: '#3D607A',

  ink: '#040B12',
  inkSurface: '#080F18',
  inkSurfaceElevated: '#0C1720',
  inkBorder: '#1A2D40',
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
