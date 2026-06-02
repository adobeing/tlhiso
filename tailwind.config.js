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
          DEFAULT: '#1E293B',
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
        sans: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
      },
      borderRadius: { card: '16px' },
      boxShadow: {
        card: '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)',
      },
    },
  },
  plugins: [],
}
