// RMF Operational Commerce design system - Cinematic Gateway Edition (Orange Brand Variant)
export const designSystem = {
  colors: {
    primary: {
      DEFAULT: '#ff6b00',
      hover: '#e05300',
      light: '#ffedd5',
      cinematic: '#9a3412',
    },
    accent: {
      DEFAULT: '#f59e0b', // Rich amber
      hover: '#d97706',
      light: '#fef3c7',
      premium: '#f59e0b', 
    },
    secondary: {
      DEFAULT: '#ea580c',
      hover: '#c2410c',
      light: '#ffedd5',
    },
    background: {
      main: '#fdfaf7', // Elegant beige with warm undertones
      card: '#FFFFFF',
      surface: '#fcfcfc',
      muted: '#f5ebe4',
      glass: 'rgba(255, 255, 255, 0.7)',
    },
    status: {
      success: '#ea580c',
      error: '#ba1a1a',
      warning: '#f59e0b',
      info: '#3B82F6',    
    },
    text: {
      primary: '#17201a',
      secondary: '#574e47',
      muted: '#80756c',
      inverse: '#FFFFFF',
    },
    border: {
      DEFAULT: '#ebdcd0',
      light: '#f2e8e0',
      dark: '#d2bca8',
      premium: 'rgba(255, 107, 0, 0.1)',
    }
  },
  typography: {
    fontFamilies: {
      sans: ['Inter', 'system-ui', 'sans-serif'],
      serif: ['Inter', 'system-ui', 'sans-serif'],
      heading: ['Inter', 'system-ui', 'sans-serif'],
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
    md: '0.4rem',
    lg: '0.75rem',
    xl: '1.25rem',
    '2xl': '1.75rem',
    full: '9999px',
  },
  shadows: {
    sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
    DEFAULT: '0 2px 4px rgba(0,0,0,0.02)',
    md: '0 8px 16px rgba(0, 0, 0, 0.04)',
    lg: '0 16px 48px rgba(0, 0, 0, 0.08)',
    xl: '0 24px 64px rgba(217, 86, 11, 0.12)', // Burnt orange-tinted premium shadow
  }
};
