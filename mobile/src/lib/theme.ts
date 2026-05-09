export const colors = {
  bg: '#030A10',
  bgAlt: '#060E17',
  surface: '#091524',
  surfaceElevated: '#0D1E30',
  surfaceHigh: '#122540',
  surfaceOverlay: 'rgba(9,21,36,0.96)',
  border: '#16273C',
  borderStrong: '#1E3550',
  borderSubtle: '#0F1E2E',

  text: '#E6F4FC',
  textSub: '#A8C4D8',
  textMuted: '#527A93',
  textQuiet: '#2E4D63',
  textDim: '#1C3347',

  signal: '#00D98C',
  signalBright: '#00F5A0',
  signalDeep: '#00A86B',
  signalDim: 'rgba(0,217,140,0.08)',
  signalGlow: 'rgba(0,217,140,0.20)',
  signalBorder: 'rgba(0,217,140,0.22)',

  danger: '#FF4757',
  dangerDim: 'rgba(255,71,87,0.10)',
  dangerBorder: 'rgba(255,71,87,0.20)',

  warning: '#FFB830',
  warningDim: 'rgba(255,184,48,0.10)',
  warningBorder: 'rgba(255,184,48,0.20)',

  purple: '#8B5CF6',
  purpleDim: 'rgba(139,92,246,0.10)',

  success: '#00D98C',

  statusPaper: '#527A93',
  statusActive: '#00D98C',
  statusCooldown: '#FFB830',
  statusFrozen: '#FF4757',
  statusClosed: '#2E4D63',

  white: '#FFFFFF',
  black: '#000000',
  transparent: 'transparent',

  ink: '#020810',
  inkSurface: '#060E18',
  inkBorder: '#12243A',
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
  xs: 6,
  sm: 10,
  md: 14,
  lg: 18,
  xl: 24,
  xxl: 32,
  card: 20,
  pill: 9999,
  full: 9999,
};

export const shadow = {
  signal: {
    shadowColor: colors.signal,
    shadowOpacity: 0.18,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
  },
  card: {
    shadowColor: '#000',
    shadowOpacity: 0.30,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  subtle: {
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
};

export const textStyles = {
  display: {
    fontSize: 42,
    fontWeight: '700' as const,
    color: colors.text,
    letterSpacing: -1.5,
  },
  hero: {
    fontSize: 34,
    fontWeight: '700' as const,
    color: colors.text,
    letterSpacing: -1.2,
  },
  title: {
    fontSize: 28,
    fontWeight: '700' as const,
    color: colors.text,
    letterSpacing: -0.8,
  },
  heading: {
    fontSize: 20,
    fontWeight: '600' as const,
    color: colors.text,
    letterSpacing: -0.4,
  },
  subheading: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: colors.text,
    letterSpacing: -0.2,
  },
  body: {
    fontSize: 14,
    fontWeight: '400' as const,
    color: colors.textSub,
    lineHeight: 22,
  },
  bodySm: {
    fontSize: 12,
    fontWeight: '400' as const,
    color: colors.textMuted,
    lineHeight: 18,
  },
  label: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: colors.textMuted,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.8,
  },
  caption: {
    fontSize: 10,
    fontWeight: '600' as const,
    color: colors.textQuiet,
    textTransform: 'uppercase' as const,
    letterSpacing: 1.0,
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
    fontWeight: '500' as const,
    color: colors.textMuted,
  },
  monoXs: {
    fontSize: 10,
    fontFamily: 'Courier',
    fontWeight: '500' as const,
    color: colors.textQuiet,
  },
};
