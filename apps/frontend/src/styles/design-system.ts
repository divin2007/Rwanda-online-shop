// Extracted from design references (screen1.png, screen2.png, 3.png, t.png)
export const designSystem = {
  colors: {
    // Primary brand color - vibrant yellow/orange for delivery focus
    primary: {
      DEFAULT: '#FFD700', // Yellow base seen in UI
      hover: '#F0C800',
      light: '#FFF9D6',
    },
    // Secondary brand - deep blue/black
    secondary: {
      DEFAULT: '#1E293B',
      hover: '#0F172A',
    },
    // Background and structural colors
    background: {
      main: '#F8FAFC',
      card: '#FFFFFF',
      surface: '#F1F5F9',
    },
    // Status colors
    status: {
      success: '#10B981', // Green for completed/approved
      error: '#EF4444',   // Red for failed/cancelled
      warning: '#F59E0B', // Orange for pending/warning
      info: '#3B82F6',    // Blue for active/transit
    },
    // Typography colors
    text: {
      primary: '#0F172A',
      secondary: '#64748B',
      muted: '#94A3B8',
      inverse: '#FFFFFF',
    },
    // Borders
    border: {
      DEFAULT: '#E2E8F0',
      light: '#F1F5F9',
      dark: '#CBD5E1',
    }
  },
  typography: {
    fontFamilies: {
      sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
      heading: ['var(--font-poppins)', 'system-ui', 'sans-serif'],
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
    sm: '4px',
    DEFAULT: '8px', // Common for cards
    md: '12px',
    lg: '16px',
    full: '9999px', // Pill buttons
  },
  shadows: {
    sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
    DEFAULT: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)', // Standard card
    md: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)', // Elevated dropdown
    lg: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)', // Modals
  }
};
