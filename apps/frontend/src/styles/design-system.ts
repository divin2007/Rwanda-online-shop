// RMF Operational Commerce design system - Stitch reference rebuild.
export const designSystem = {
  colors: {
    primary: {
      DEFAULT: '#ff6b00',
      hover: '#e05300',
      light: '#ffedd5',
      dark: '#ff6b00',
      fixed: '#ffdbcc',
    },
    accent: {
      DEFAULT: '#f59e0b', // Rich amber
      hover: '#d97706',
      light: '#fef3c7',
      premium: '#f59e0b',
    },
    secondary: {
      DEFAULT: '#a63b00',
      hover: '#7f2b00',
      light: '#ffdbce',
    },
    tertiary: {
      DEFAULT: '#3b82f6',
      hover: '#005ac2',
      light: '#d8e2ff',
    },
    background: {
      main: '#fbf9f8',
      card: '#FFFFFF',
      surface: '#f5f3f3',
      muted: '#efeded',
      high: '#e9e8e7',
      highest: '#e3e2e2',
    },
    status: {
      success: '#12805c',
      error: '#ba1a1a',
      warning: '#f59e0b',
      info: '#3B82F6',
    },
    text: {
      primary: '#1b1c1c',
      secondary: '#574e47',
      muted: '#8e7164',
      inverse: '#FFFFFF',
    },
    border: {
      DEFAULT: '#ebdcd0',
      light: '#e2bfb0',
      dark: '#8e7164',
      premium: '#e2bfb0',
    }
  },
  typography: {
    fontFamilies: {
      sans: ['var(--font-work-sans)', 'Work Sans', 'system-ui', 'sans-serif'],
      serif: ['var(--font-work-sans)', 'Work Sans', 'system-ui', 'sans-serif'],
      heading: ['var(--font-work-sans)', 'Work Sans', 'system-ui', 'sans-serif'],
      mono: ['var(--font-jetbrains-mono)', 'JetBrains Mono', 'ui-monospace', 'monospace'],
    },
  },
  spacing: {
    xs: '0.25rem',   // 4px
    sm: '0.5rem',    // 8px
    md: '1rem',      // 16px
    lg: '1.5rem',    // 24px
    xl: '2rem',      // 32px
    '2xl': '3rem',    // 48px
    '3xl': '4.5rem',  // 72px
  },
  borderRadius: {
    sm: '0.125rem',
    DEFAULT: '0.25rem',
    md: '0.375rem',
    lg: '0.5rem',
    xl: '0.75rem',
    '2xl': '0.75rem',
    full: '9999px',
  },
  shadows: {
    sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
    DEFAULT: '0 1px 3px rgba(27, 28, 28, 0.04)',
    md: '0 6px 14px rgba(27, 28, 28, 0.06)',
    lg: '0 12px 28px rgba(27, 28, 28, 0.08)',
    xl: '0 18px 48px rgba(27, 28, 28, 0.10)',
  }
};
