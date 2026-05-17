/**
 * formatters.js — Shared display-formatting utilities.
 *
 * Extracted from individual components (DependencyGraph, PodTable) because:
 *   1. `formatAge` was duplicated in both — single source of truth prevents drift.
 *   2. Formatters are pure functions — easy to unit-test in isolation.
 *   3. Any new component that shows pod age imports from here, not from a sibling component.
 */

/**
 * Convert raw minutes to a human-readable age string.
 * Used by PodTable, NodeDrawer, and any future list views.
 */
export function formatAge(minutes) {
  if (!minutes) return '—';
  if (minutes < 60)   return `${minutes}m`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
  return `${Math.floor(minutes / 1440)}d ${Math.floor((minutes % 1440) / 60)}h`;
}

/**
 * Format millicores as a human-readable CPU string.
 * 450m → "450m", 2000m → "2.0 cores"
 */
export function formatCpu(millicores) {
  if (!millicores) return '0m';
  if (millicores >= 1000) return `${(millicores / 1000).toFixed(1)} cores`;
  return `${millicores}m`;
}

/**
 * Format megabytes as MB or GB.
 * Used wherever raw memory_mb values need display.
 */
export function formatBytes(mb) {
  if (!mb) return '0 MB';
  if (mb >= 1024) return `${(mb / 1024).toFixed(2)} GB`;
  return `${mb.toFixed(0)} MB`;
}
