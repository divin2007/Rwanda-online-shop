// Solaris Ivory mobile design system, adapted from the Stitch reference.
export const colors = {
  primary: '#a04100',
  primaryDark: '#572000',
  primarySoft: '#ffdbcc',
  primaryMid: '#ff6b00',
  primaryFixedDim: '#ffb693',

  ink: '#1b1c1b',
  body: '#5a4136',
  muted: '#6c5b4b',
  faint: '#8e7164',
  divider: '#e2bfb0',
  bg: '#fbf9f8',
  card: '#ffffff',
  cardHover: '#f5f3f2',
  surface: '#fbf9f8',
  surfaceLow: '#f5f3f2',
  surfaceMid: '#efedec',
  surfaceHigh: '#e9e8e7',
  surfaceHighest: '#e4e2e1',
  inverse: '#303030',

  paper: '#fbf9f8',
  line: '#e2bfb0',
  orange: '#ff6b00',
  orangeDark: '#a04100',
  orangeSoft: '#ffdbcc',
  green: '#16a34a',
  greenDark: '#166534',
  greenSoft: '#dcfce7',
  danger: '#ba1a1a',
  success: '#16a34a',
  warning: '#f59e0b',

  gold: '#ffb693',
  blue: '#3B82F6',
  blueSoft: '#E8F0FC',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 40,
};

export const radii = {
  xs: 4,
  sm: 4,
  md: 6,
  lg: 8,
  xl: 12,
  full: 999,
};

export const typography = {
  regular: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
  heavy: '800' as const,
  black: '900' as const,

  xs: 10,
  sm: 12,
  md: 14,
  lg: 16,
  xl: 18,
  xxl: 24,
  display: 32,
};

export const shadow = {
  shadowColor: '#1b1c1b',
  shadowOffset: { width: 0, height: 8 },
  shadowOpacity: 0.03,
  shadowRadius: 30,
  elevation: 1,
};

export const shadowMd = {
  shadowColor: '#1b1c1b',
  shadowOffset: { width: 0, height: 10 },
  shadowOpacity: 0.06,
  shadowRadius: 24,
  elevation: 3,
};

export const shadowLg = {
  shadowColor: '#a04100',
  shadowOffset: { width: 0, height: 10 },
  shadowOpacity: 0.12,
  shadowRadius: 26,
  elevation: 6,
};
