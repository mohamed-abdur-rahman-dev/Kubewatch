/**
 * constants.js — Static lookup tables shared across multiple components.
 *
 * Centralised here because:
 *   1. RULE_LABELS was duplicated in InsightPanel and would need to stay in sync.
 *   2. STATUS_TOKENS was inlined in DependencyGraph; NodeDrawer needed the same values.
 *   3. STATUS_ORDER was inlined in PodTable.
 *
 * If a value appears in two or more files, it belongs here.
 */

/** Sort order for pod status: critical first, then warning, then healthy. */
export const STATUS_ORDER = { critical: 0, warning: 1, healthy: 2 };

/**
 * Human-readable labels for rule engine keys.
 * Keys match the `issues` array in AnomalyEvent from the backend.
 */
export const RULE_LABELS = {
  cpu_critical:    'CPU critical (>80%)',
  cpu_high:        'CPU elevated (>60%)',
  memory_critical: 'Memory critical (>85%)',
  memory_high:     'Memory elevated (>70%)',
  crash_looping:   'Crash-looping (5+ restarts)',
  restarting:      'Unstable — multiple restarts',
  not_running:     'Pod not in Running state',
  oom_risk:        'High OOM termination risk',
};

/**
 * Design tokens per pod status — colors used by graph nodes, anomaly cards,
 * status dots, and the drawer badge.
 *
 * Single source of truth: changing a color here updates all status-colored UI.
 */
export const STATUS_TOKENS = {
  critical: {
    border:    '#DC2626',
    bg:        '#1C0505',
    dot:       '#EF4444',
    glow:      'rgba(239,68,68,0.2)',
    badge:     '#7F1D1D',
    badgeText: '#FCA5A5',
  },
  warning: {
    border:    '#D97706',
    bg:        '#1C1500',
    dot:       '#F59E0B',
    glow:      'rgba(245,158,11,0.12)',
    badge:     '#78350F',
    badgeText: '#FCD34D',
  },
  healthy: {
    border:    '#16A34A',
    bg:        '#052E16',
    dot:       '#22C55E',
    glow:      'rgba(34,197,94,0.12)',
    badge:     '#052e16',
    badgeText: '#4ade80',
  },
};
