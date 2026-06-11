/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#5B8E7D',
          light: '#EBF5F1',
        },
        sidebar: {
          DEFAULT: '#1a2236',
          text: '#94A3B8',
          active: '#5B8E7D',
        },
        surface: {
          DEFAULT: '#FFFFFF',
          2: '#F8FAFC',
        },
        border: '#E2E8F0',
        ink: {
          DEFAULT: '#0F172A',
          secondary: '#64748B',
        },
        alert: {
          orange: '#F97316',
          red: '#EF4444',
          blue: '#3B82F6',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 3px rgba(0,0,0,0.07), 0 1px 2px rgba(0,0,0,0.05)',
        'card-hover': '0 4px 12px rgba(0,0,0,0.08), 0 2px 4px rgba(0,0,0,0.05)',
        'card-lg': '0 8px 24px rgba(0,0,0,0.10), 0 2px 8px rgba(0,0,0,0.06)',
        'glow-primary': '0 0 0 3px rgba(91,142,125,0.25)',
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-out both',
        'slide-up': 'slideUp 0.25s ease-out both',
        'scale-in': 'scaleIn 0.18s ease-out both',
      },
      keyframes: {
        fadeIn: { from: { opacity: '0' }, to: { opacity: '1' } },
        slideUp: { from: { opacity: '0', transform: 'translateY(8px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        scaleIn: { from: { opacity: '0', transform: 'scale(0.96)' }, to: { opacity: '1', transform: 'scale(1)' } },
      },
    },
    borderRadius: {
      none: '0px',
      sm: '4px',
      DEFAULT: '6px',
      md: '8px',
      lg: '10px',
      xl: '14px',
      '2xl': '18px',
      '3xl': '24px',
      card: '12px',
      full: '9999px',
    },
  },
  plugins: [],
}
