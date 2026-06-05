import type { Config } from 'tailwindcss'

export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: 'var(--bg)',
        bg2: 'var(--bg2)',
        bg3: 'var(--bg3)',
        bg4: 'var(--bg4)',
        t1: 'var(--t1)',
        t2: 'var(--t2)',
        t3: 'var(--t3)',
        accent: 'var(--accent)',
        accent2: 'var(--accent2)',
        green: 'var(--green)',
        amber: 'var(--amber)',
        red: 'var(--red)',
        trace: {
          bg: 'var(--bg)',
          panel: 'var(--bg2)',
          panelSoft: 'var(--bg3)',
          border: 'var(--border)',
          accent: 'var(--accent)',
          muted: 'var(--t2)',
        },
      },
      fontFamily: {
        sans: ['DM Sans', 'sans-serif'],
        mono: ['Geist Mono', 'monospace'],
        display: ['DM Sans', 'sans-serif'],
        body: ['DM Sans', 'sans-serif'],
      },
      borderColor: {
        DEFAULT: 'var(--border)',
        2: 'var(--border2)',
      },
      borderRadius: {
        traceSm: 'var(--radius-sm)',
        traceMd: 'var(--radius-md)',
        traceLg: 'var(--radius-lg)',
      },
      boxShadow: {
        glow: '0 0 0 1px rgba(94, 139, 255, 0.22), 0 12px 42px rgba(0, 0, 0, 0.28)',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeUp: {
          '0%': { opacity: '0', transform: 'translateY(5px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        fadeIn: 'fadeIn 250ms ease-out',
        fadeUp: 'fadeUp 250ms ease',
      },
    },
  },
  plugins: [],
} satisfies Config
