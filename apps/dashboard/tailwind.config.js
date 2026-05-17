/**
 * tailwind.config.js — Tailwind CSS configuration.
 *
 * Moved from: frontend/tailwind.config.js
 * content paths are relative — still correct after the move.
 *
 * Custom keyframes are NOT here because they live in styles/index.css as
 * @keyframes blocks with matching utility classes. Tailwind animates from here
 * only what can't be expressed in CSS @keyframes (e.g. arbitrary durations).
 */
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        background: '#0A0F1E',
        surface:    '#0F1629',
        primary:    '#2563EB',
        secondary:  '#475569',
        success:    '#22C55E',
        warning:    '#F59E0B',
        danger:     '#EF4444',
      },
      animation: {
        'slide-up':  'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'spin-slow': 'spin 8s linear infinite',
      },
      keyframes: {
        slideUp: {
          '0%':   { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
};
