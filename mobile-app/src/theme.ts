// ─────────────────────────────────────────────────────────────────────────────
// RMF Design System — Alibaba-Inspired Premium Theme
// ─────────────────────────────────────────────────────────────────────────────

export const colors = {
  // Brand, matched to the current RMF web design system.
  primary: '#ff6b00',
  primaryDark: '#e05300',
  primarySoft: '#ffedd5',
  primaryMid: '#ff8c3a',

  // Neutrals
  ink: '#17201a',
  body: '#574e47',
  muted: '#80756c',
  faint: '#a89b91',
  divider: '#ebdcd0',
  bg: '#fdfaf7',
  card: '#ffffff',
  cardHover: '#fcf9f8',

  // Legacy aliases (keep compatibility with existing code)
  paper: '#fdfaf7',
  line: '#ebdcd0',
  orange: '#ff6b00',
  orangeDark: '#e05300',
  orangeSoft: '#ffedd5',
  green: '#ea580c',
  greenDark: '#17201a',
  greenSoft: '#fff7ed',
  danger: '#ba1a1a',
  success: '#ea580c',
  warning: '#f59e0b',

  // Accent
  gold: '#f59e0b',
  blue: '#3B82F6',
  blueSoft: '#E8F0FC',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

export const radii = {
  xs: 4,
  sm: 6,
  md: 8,
  lg: 12,
  xl: 16,
  full: 999,
};

export const typography = {
  // Weights
  regular: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
  heavy: '800' as const,
  black: '900' as const,

  // Sizes
  xs: 10,
  sm: 12,
  md: 14,
  lg: 16,
  xl: 18,
  xxl: 22,
  display: 28,
};

export const shadow = {
  shadowColor: '#000000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.06,
  shadowRadius: 8,
  elevation: 2,
};

export const shadowMd = {
  shadowColor: '#000000',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.10,
  shadowRadius: 12,
  elevation: 4,
};

export const shadowLg = {
  shadowColor: '#ff6b00',
  shadowOffset: { width: 0, height: 6 },
  shadowOpacity: 0.18,
  shadowRadius: 20,
  elevation: 8,
};
