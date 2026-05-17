/**
 * NodeDrawer.jsx — Slide-in side panel shown when a graph node is clicked.
 *
 * Extracted from DependencyGraph.jsx because:
 *   1. The drawer has its own state (copied/not-copied per command), unrelated to graph layout.
 *   2. Kubectl command formatting belongs here, not in graph rendering logic.
 *   3. The drawer is independently testable and reusable in a future list view.
 *
 * Receives the full pod object from the parent (GraphInner merges graph data
 * with live pod data from the /pods endpoint).
 */
import PropTypes from 'prop-types';
import { useState } from 'react';
import { STATUS_TOKENS } from '../../utils/constants';
import { formatAge } from '../../utils/formatters';

/**
 * CommandBlock — one kubectl command with an inline copy button.
 * Kept here (not in utils) because it's a display-only UI atom, not shared logic.
 */
export function CommandBlock({ cmd }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="mb-2 rounded-lg border border-[#1E2D45] bg-[#0A0F1E] overflow-hidden">
      <code className="block px-2 py-2 text-green-400 font-mono text-[9px] break-all leading-relaxed">
        {cmd}
      </code>
      <button
        onClick={() =>
          navigator.clipboard.writeText(cmd).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          })
        }
        className={`w-full px-2 py-1 text-[9px] border-t border-[#1E2D45] transition-colors text-left ${
          copied
            ? 'text-green-400 bg-green-900/20'
            : 'text-[#475569] hover:text-white hover:bg-[#1A2235]'
        }`}
      >
        {copied ? '✓ Copied' : 'Copy ↗'}
      </button>
    </div>
  );
}
CommandBlock.propTypes = { cmd: PropTypes.string };

/**
 * PodDrawer — full-height slide-in panel with metrics + quick commands.
 * The --previous flag is added to `kubectl logs` automatically when restarts > 0,
 * because that's the most common next action after spotting a crash-looping pod.
 */
export function PodDrawer({ pod, onClose }) {
  const c = STATUS_TOKENS[pod.status] ?? STATUS_TOKENS.healthy;

  const commands = [
    `kubectl logs ${pod.name} -n ${pod.namespace}${pod.restarts > 0 ? ' --previous' : ''}`,
    `kubectl describe pod ${pod.name} -n ${pod.namespace}`,
    `kubectl delete pod ${pod.name} -n ${pod.namespace}`,
  ];

  return (
    <div
      className="absolute right-0 top-0 h-full w-64 z-20 animate-slide-right border-l border-[#1E2D45] overflow-y-auto"
      style={{ background: '#0F1629' }}
    >
      {/* Header — sticky so pod name stays visible while scrolling commands */}
      <div
        className="flex items-center justify-between px-3 py-3 border-b border-[#1E2D45] sticky top-0"
        style={{ background: '#0F1629' }}
      >
        <div className="flex items-center gap-2">
          <div
            className={`w-2 h-2 rounded-full flex-shrink-0 ${
              pod.status === 'critical' ? 'bg-red-500 animate-live'
              : pod.status === 'warning' ? 'bg-amber-500'
              : 'bg-green-500'
            }`}
          />
          <span className="text-white font-semibold text-xs">Pod Details</span>
        </div>
        <button
          onClick={onClose}
          className="text-[#475569] hover:text-white transition-colors text-sm w-6 h-6 flex items-center justify-center rounded hover:bg-[#1A2235]"
        >
          ✕
        </button>
      </div>

      {/* Pod identity */}
      <div className="px-3 py-3 border-b border-[#1E2D45]">
        <p className="text-[#475569] text-[9px] uppercase tracking-widest mb-1">Pod Name</p>
        <p className="text-white font-mono text-[11px] break-all leading-relaxed">{pod.name}</p>
        <p className="text-[#475569] text-[10px] mt-1 font-mono">{pod.namespace}</p>
      </div>

      {/* Live metrics — alert color when threshold exceeded */}
      <div className="px-3 py-3 space-y-3 border-b border-[#1E2D45]">
        {[
          { label: 'CPU Usage',    value: `${(pod.cpu_percent ?? 0).toFixed(1)}%`,    alert: (pod.cpu_percent ?? 0) > 80 },
          { label: 'Memory Usage', value: `${(pod.memory_percent ?? 0).toFixed(1)}%`, alert: (pod.memory_percent ?? 0) > 85 },
          { label: 'Restarts',     value: pod.restarts ?? 0,                           alert: (pod.restarts ?? 0) >= 3 },
          { label: 'Phase',        value: pod.phase ?? '—',                            alert: pod.phase && pod.phase !== 'Running' },
          { label: 'Age',          value: formatAge(pod.age_minutes),                  alert: false },
        ].map(row => (
          <div key={row.label} className="flex items-center justify-between">
            <span className="text-[#475569] text-[10px]">{row.label}</span>
            <span className={`font-mono text-[11px] font-semibold ${row.alert ? 'text-red-400' : 'text-[#94A3B8]'}`}>
              {String(row.value)}
            </span>
          </div>
        ))}
      </div>

      {/* Status badge */}
      <div className="px-3 py-2 border-b border-[#1E2D45]">
        <div
          className="flex items-center gap-2 px-2 py-1 rounded-md"
          style={{ background: c.bg, border: `1px solid ${c.border}` }}
        >
          <div className="w-1.5 h-1.5 rounded-full" style={{ background: c.dot }} />
          <span className="text-xs font-bold" style={{ color: c.dot }}>
            {(pod.status ?? 'healthy').toUpperCase()}
          </span>
        </div>
      </div>

      {/* Quick commands — most useful ops for on-call engineers */}
      <div className="px-3 py-3">
        <p className="text-[#475569] text-[9px] uppercase tracking-widest mb-2">Quick Commands</p>
        {commands.map((cmd, i) => (
          <CommandBlock key={i} cmd={cmd} />
        ))}
      </div>
    </div>
  );
}
PodDrawer.propTypes = { pod: PropTypes.object, onClose: PropTypes.func };
