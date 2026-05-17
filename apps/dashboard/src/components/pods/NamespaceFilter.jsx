/**
 * NamespaceFilter.jsx — Namespace pill buttons and collapsible pod sections.
 *
 * Extracted from PodTable.jsx because:
 *   1. Filter pills and section headers are layout concerns separate from row rendering.
 *   2. The Section component manages its own expand/collapse state — clean isolation.
 *   3. NamespaceFilter can be reused in a future full-page pod list view.
 *
 * Exports:
 *   NamespaceFilter — pill row for selecting a namespace
 *   Section         — collapsible group of pods with a header
 */
import PropTypes from 'prop-types';
import { useState } from 'react';
import { STATUS_ORDER } from '../../utils/constants';
import PodRows, { TABLE_HEAD } from './PodRow';

/**
 * NamespaceFilter — renders "All namespaces" + one pill per unique namespace.
 * The count shown in each pill always reflects the full (unfiltered) pod list
 * so users know how many pods a namespace has before switching to it.
 */
export function NamespaceFilter({ pods, filterNs, setFilterNs }) {
  const namespaces = ['all', ...new Set(pods.map(p => p.namespace))];

  return (
    <div className="flex items-center gap-1.5 px-4 py-2 border-b border-[#1E2D45] flex-wrap">
      {namespaces.map(ns => (
        <button
          key={ns}
          onClick={() => setFilterNs(ns)}
          className={`px-2.5 py-1 rounded-full text-[10px] font-medium border transition-all ${
            filterNs === ns
              ? 'bg-blue-600 text-white border-blue-600'
              : 'bg-transparent text-[#475569] border-[#1E2D45] hover:text-white hover:border-[#334155]'
          }`}
        >
          {ns === 'all' ? 'All namespaces' : ns}
          <span className="ml-1 opacity-60">
            ({ns === 'all' ? pods.length : pods.filter(p => p.namespace === ns).length})
          </span>
        </button>
      ))}
    </div>
  );
}
NamespaceFilter.propTypes = {
  pods:        PropTypes.array.isRequired,
  filterNs:    PropTypes.string.isRequired,
  setFilterNs: PropTypes.func.isRequired,
};

/**
 * Section — collapsible group header + table.
 * Critical pods sort to the top within each section.
 * defaultOpen=true for user-facing (campus) pods, false for system pods
 * so system pods don't clutter the initial view.
 */
export function Section({ icon, title, pods, defaultOpen }) {
  const [expanded, setExpanded]   = useState(defaultOpen);
  const sorted      = [...pods].sort(
    (a, b) => (STATUS_ORDER[a.status] ?? 3) - (STATUS_ORDER[b.status] ?? 3)
  );
  const criticalCount = pods.filter(p => p.status === 'critical').length;

  return (
    <div className="mb-1">
      <div
        className="flex items-center gap-2 px-4 py-2.5 cursor-pointer select-none hover:bg-[#1A2235] transition-colors"
        onClick={() => setExpanded(e => !e)}
      >
        <span className="text-base">{icon}</span>
        <span className="text-white font-semibold text-sm">{title}</span>
        <span className="text-[#475569] text-xs ml-1">({pods.length})</span>
        {criticalCount > 0 && (
          <span className="ml-1 px-2 py-0.5 rounded-full bg-red-900/50 text-red-300 text-[9px] font-bold border border-red-800 animate-pulse">
            {criticalCount} critical
          </span>
        )}
        <span
          className={`ml-auto text-[#475569] text-xs transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
        >
          ▼
        </span>
      </div>

      {expanded && (
        <table className="w-full" style={{ tableLayout: 'fixed' }}>
          {TABLE_HEAD}
          <PodRows pods={sorted} />
        </table>
      )}
    </div>
  );
}
Section.propTypes = {
  icon:        PropTypes.string,
  title:       PropTypes.string,
  pods:        PropTypes.array,
  defaultOpen: PropTypes.bool,
};
