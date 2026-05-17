/**
 * PodRow.jsx — Renders the tbody rows for a list of pods.
 *
 * Extracted from PodTable.jsx because:
 *   1. Row rendering (StatusDot, ResourceBar, RestartBadge) is pure display logic
 *      that doesn't need to know about namespace filtering or section collapsing.
 *   2. Isolating row rendering makes it easy to add row-click handlers, row
 *      selection, or keyboard navigation in the future without touching filter logic.
 *   3. PodTable.jsx stays focused on layout, sections, and filter state.
 *
 * Exports: PodRows (renders a list of pods), plus the sub-components
 * StatusDot, ResourceBar, RestartBadge for potential reuse.
 */
import PropTypes from 'prop-types';
import { useState } from 'react';
import { formatAge } from '../../utils/formatters';

/** Animated dot showing critical/warning/healthy status at a glance. */
export function StatusDot({ status }) {
  if (status === 'critical') {
    return (
      <div
        className="w-2 h-2 rounded-full flex-shrink-0 bg-red-500 animate-live"
        style={{ boxShadow: '0 0 6px rgba(239,68,68,0.7)' }}
      />
    );
  }
  if (status === 'warning') {
    return <div className="w-2 h-2 rounded-full flex-shrink-0 bg-amber-500" />;
  }
  return (
    <div
      className="w-2 h-2 rounded-full flex-shrink-0 bg-green-500"
      style={{ boxShadow: '0 0 4px rgba(34,197,94,0.4)' }}
    />
  );
}
StatusDot.propTypes = { status: PropTypes.string };

/**
 * ResourceBar — horizontal mini progress bar for CPU or memory.
 * CPU uses green→amber→red; Memory uses blue→amber→red.
 * Different color scales reflect different risk thresholds per resource type.
 */
export function ResourceBar({ pct, type }) {
  const color =
    type === 'mem'
      ? pct > 85 ? '#EF4444' : pct > 70 ? '#F59E0B' : '#3B82F6'
      : pct > 80 ? '#EF4444' : pct > 60 ? '#F59E0B' : '#22C55E';

  return (
    <div className="flex items-center gap-2">
      <div className="w-20 h-1.5 rounded-full bg-[#1A2235]">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${Math.min(pct, 100)}%`, background: color }}
        />
      </div>
      <span className="font-mono text-xs text-[#94A3B8]">{pct.toFixed(1)}%</span>
    </div>
  );
}
ResourceBar.propTypes = { pct: PropTypes.number.isRequired, type: PropTypes.string };

/** Badge showing restart count — red for 5+, amber for 3–4, neutral otherwise. */
export function RestartBadge({ count }) {
  if (count === 0) return <span className="text-[#334155] text-xs font-mono">—</span>;
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-mono text-xs font-bold border ${
        count >= 5
          ? 'bg-red-900/50 text-red-300 border-red-700'
          : count >= 3
          ? 'bg-amber-900/50 text-amber-300 border-amber-700'
          : 'bg-gray-800 text-gray-400 border-gray-700'
      }`}
    >
      ↺ {count}
    </span>
  );
}
RestartBadge.propTypes = { count: PropTypes.number.isRequired };

/**
 * PodNameCell — truncated pod name with hover tooltip for full name + copy button.
 * Only shows tooltip for names longer than 28 chars (shorter names never overflow).
 */
function PodNameCell({ name, namespace }) {
  const isTruncated = name.length > 28;
  const [tooltipVisible, setTooltipVisible] = useState(false);
  const [copied, setCopied] = useState(false);

  return (
    <div
      className="relative"
      onMouseEnter={() => isTruncated && setTooltipVisible(true)}
      onMouseLeave={() => { setTooltipVisible(false); setCopied(false); }}
    >
      <p
        className="font-mono text-xs text-white font-medium cursor-default"
        style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
      >
        {name}
      </p>
      <p className="text-[#475569] text-[10px] mt-0.5">{namespace}</p>

      {isTruncated && tooltipVisible && (
        <div
          className="absolute left-0 top-full mt-1 rounded-lg border border-[#1E2D45] bg-[#0F1629] p-2.5 z-30 shadow-xl"
          style={{ minWidth: 'max-content', maxWidth: '18rem' }}
        >
          <p className="text-[#475569] text-[9px] mb-1">Full name</p>
          <p className="font-mono text-green-400 text-[10px] break-all">{name}</p>
          <button
            onClick={(e) => {
              e.stopPropagation();
              navigator.clipboard.writeText(name).then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              });
            }}
            className={`mt-2 w-full py-1 text-[9px] rounded border border-[#1E2D45] transition-colors ${
              copied
                ? 'bg-green-900/30 text-green-400 border-green-800'
                : 'bg-[#1A2235] text-[#94A3B8] hover:text-white hover:bg-[#1E2A40]'
            }`}
          >
            {copied ? '✓ Copied' : 'Copy full name'}
          </button>
        </div>
      )}
    </div>
  );
}
PodNameCell.propTypes = { name: PropTypes.string.isRequired, namespace: PropTypes.string };

/** Column headers — static, no sorting (sorting is done before rows are passed here). */
export const TABLE_HEAD = (
  <thead>
    <tr className="border-b border-[#1E2D45]">
      {['Status', 'Pod', 'CPU', 'Memory', 'Restarts', 'Age'].map(h => (
        <th
          key={h}
          className="px-4 py-2.5 text-left text-[10px] font-semibold text-[#475569] uppercase tracking-widest"
        >
          {h}
        </th>
      ))}
    </tr>
  </thead>
);

/** Renders one tbody from a pre-sorted, pre-filtered list of pods. */
export default function PodRows({ pods }) {
  return (
    <tbody>
      {pods.map(pod => (
        <tr
          key={pod.name}
          className="border-b border-[#162032] hover:bg-[#1A2235] transition-colors duration-150"
          style={{ background: pod.status === 'critical' ? 'rgba(220,38,38,0.04)' : 'transparent' }}
        >
          <td className="px-4 py-3">
            <div className="flex items-center gap-2">
              <StatusDot status={pod.status} />
              <span className="text-[#94A3B8] text-xs">{pod.phase}</span>
            </div>
          </td>
          <td className="px-4 py-3">
            <PodNameCell name={pod.name} namespace={pod.namespace} />
          </td>
          <td className="px-4 py-3"><ResourceBar pct={pod.cpu_percent}    type="cpu" /></td>
          <td className="px-4 py-3"><ResourceBar pct={pod.memory_percent} type="mem" /></td>
          <td className="px-4 py-3"><RestartBadge count={pod.restarts} /></td>
          <td className="px-4 py-3">
            <span className="text-[#475569] text-xs font-mono">{formatAge(pod.age_minutes)}</span>
          </td>
        </tr>
      ))}
    </tbody>
  );
}
PodRows.propTypes = { pods: PropTypes.array.isRequired };
