/**
 * tokens.js — Design system tokens for the AI Pod Observer dashboard.
 *
 * Moved from frontend/src/styles/design-tokens.js and renamed to tokens.js
 * to match the monorepo naming convention (shorter, no hyphens).
 *
 * Usage:
 *   import { COLORS, FONT, SHADOW, RADIUS } from '../styles/tokens';
 *
 * These are reference values for developers. Tailwind utility classes in
 * components are preferred for layout/spacing; these tokens are for inline
 * styles where Tailwind can't reach (e.g., SVG fills, dynamic calc).
 */

export const COLORS = {
  bg: {
    base:    '#0A0F1E',  // page background — deepest navy
    card:    '#0F1629',  // card / panel background
    panel:   '#111827',
    surface: '#1A2235',  // interactive surface (hover targets, bars)
    hover:   '#1E2A40',
    input:   '#151F30',
  },
  border: {
    default: '#1E2D45',
    subtle:  '#162032',
    active:  '#2563EB',
    glow:    '#3B82F6',
  },
  status: {
    healthy: {
      bg:     '#052E16',
      border: '#16A34A',
      text:   '#4ADE80',
      dot:    '#22C55E',
      glow:   'rgba(34,197,94,0.15)',
    },
    warning: {
      bg:     '#1C1500',
      border: '#D97706',
      text:   '#FBBF24',
      dot:    '#F59E0B',
      glow:   'rgba(245,158,11,0.15)',
    },
    critical: {
      bg:     '#1C0505',
      border: '#DC2626',
      text:   '#F87171',
      dot:    '#EF4444',
      glow:   'rgba(239,68,68,0.2)',
    },
    system: {
      bg:     '#0F1A2E',
      border: '#334155',
      text:   '#94A3B8',
      dot:    '#64748B',
    },
  },
  text: {
    primary:   '#F1F5F9',
    secondary: '#94A3B8',
    muted:     '#475569',
    accent:    '#60A5FA',
    code:      '#34D399',
  },
  accent: {
    blue:   '#2563EB',
    purple: '#7C3AED',
    teal:   '#0891B2',
    orange: '#EA580C',
  },
};

export const FONT = {
  sans: "'Inter', 'system-ui', sans-serif",
  mono: "'JetBrains Mono', 'Fira Code', monospace",
};

export const SHADOW = {
  card:     '0 1px 3px rgba(0,0,0,0.4), 0 1px 2px rgba(0,0,0,0.3)',
  elevated: '0 4px 16px rgba(0,0,0,0.5)',
  glow_red: '0 0 20px rgba(239,68,68,0.25)',
  glow_grn: '0 0 20px rgba(34,197,94,0.15)',
};

export const RADIUS = {
  sm:   '6px',
  md:   '10px',
  lg:   '14px',
  xl:   '18px',
  full: '9999px',
};
