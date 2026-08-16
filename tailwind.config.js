/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Olive — the Mediterranean guide's own colour, and calmer than the
        // signal-green the app used to run on.
        brand: {
          50:  '#f6f7ee',
          100: '#e9edd3',
          200: '#d5dcac',
          300: '#bcc77f',
          400: '#a3b25b',
          500: '#87973f',
          600: '#69782f',
          700: '#515c28',
          800: '#414a25',
          900: '#383f23',
        },
        // Warm terracotta, for accents and anything that needs to feel alive.
        clay: {
          50:  '#fdf5f3',
          100: '#fbe8e3',
          200: '#f8d5cc',
          300: '#f1b7a8',
          400: '#e78e76',
          500: '#d96a4c',
          600: '#c5502f',
          700: '#a44026',
          800: '#883824',
          900: '#723324',
        },
        // Page and card grounds — paper rather than clinical grey.
        sand: {
          50:  '#fbf9f5',
          100: '#f5f1e8',
          200: '#ebe4d5',
          300: '#ddd2ba',
          400: '#c9b995',
          500: '#b8a37a',
        },
        xp: {
          50:  '#faf5ff',
          100: '#f3e8ff',
          200: '#e9d5ff',
          300: '#d8b4fe',
          400: '#c084fc',
          500: '#a855f7',
          600: '#9333ea',
          700: '#7e22ce',
          800: '#6b21a8',
          900: '#581c87',
        },
        gold: {
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'float': 'float 3s ease-in-out infinite',
        'bar-fill': 'barFill 1s ease-out forwards',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-4px)' },
        },
        barFill: {
          from: { width: '0%' },
          to: { width: 'var(--bar-width)' },
        },
      },
    },
  },
  plugins: [],
}
