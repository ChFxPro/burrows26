/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['\"Sora\"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        body: ['\"Source Sans 3\"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 10px 35px -18px rgba(20, 31, 63, 0.35)',
      },
      colors: {
        brand: {
          50: '#ecfdf5',
          100: '#d1fae5',
          500: '#10b981',
          600: '#059669',
          700: '#047857',
        },
      },
      maxWidth: {
        dashboard: '86rem',
      },
      animation: {
        fadeIn: 'fadeIn 400ms ease-out',
        pulseSoft: 'pulseSoft 1.2s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: 0, transform: 'translateY(8px)' },
          '100%': { opacity: 1, transform: 'translateY(0)' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: 0.45 },
          '50%': { opacity: 1 },
        },
      },
    },
  },
  plugins: [],
};
