// RMF (Rwanda Market Facilitator) Design System - Matching Reference Screenshot
export const designSystem = {
  colors: {
    primary: {
      DEFAULT: '#F59E0B', // RMF Amber (Yellow Version)
      hover: '#D97706',
      light: '#F59E0B1A',
    },
    secondary: {
      DEFAULT: '#1A1A1A', // Charcoal
      hover: '#000000',
    },
    background: {
      main: '#F9F7F2', // Cream
      card: '#FFFFFF',
      surface: '#FDFCFB',
    },
    status: {
      success: '#1a7f4b', 
      error: '#EF4444',   
      warning: '#F59E0B', 
      info: '#3B82F6',    
    },
    text: {
      primary: '#1A1A1A',
      secondary: '#6B665E', // Muted brownish gray
      muted: '#A8A29A',
      inverse: '#FFFFFF',
    },
    border: {
      DEFAULT: '#E5E1D8',
      light: '#F2F0EB',
      dark: '#D1CCC0',
    }
  },
  typography: {
    fontFamilies: {
      sans: ['Inter', 'system-ui', 'sans-serif'],
      serif: ['Playfair Display', 'serif'],
      heading: ['Playfair Display', 'serif'],
    },
  },
  spacing: {
    xs: '4px',
    sm: '8px',
    md: '16px',
    lg: '24px',
    xl: '32px',
    '2xl': '48px',
  },
  borderRadius: {
    sm: '0px', // Screenshot uses very sharp corners for primary buttons
    DEFAULT: '4px',
    md: '8px',
    lg: '12px',
    full: '9999px',
  },
  shadows: {
    sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
    DEFAULT: '0 2px 4px rgba(0,0,0,0.02)',
    md: '0 4px 6px rgba(0,0,0,0.04)',
    lg: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
  }
};
