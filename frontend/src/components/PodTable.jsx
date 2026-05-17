import PropTypes from 'prop-types';
import { useState } from 'react';

const STATUS_ORDER = { critical: 0, warning: 1, healthy: 2 };

function formatAge(minutes) {
  if (!minutes) return '—';
  if (minutes < 60)   return `${minutes}m`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
  return `${Math.floor(minutes / 1440)}d ${Math.floor((minutes % 1440) / 60)}h`;
}

function StatusDot({ status }) {
  if (status === 'critical') {
    return <div className="w-2 h-2 rounded-full flex-shrink-0 bg-red-500 animate-live" style={{ boxShadow: '0 0 6px rgba(239,68,68,0.7)' }} />;
  }
  if (status === 'warning') {
    return <div className="w-2 h-2 rounded-full flex-shrink-0 bg-amber-500" />;
  }
  return <div className="w-2 h-2 rounded-full flex-shrink-0 bg-green-500" style={{ boxShadow: '0 0 4px rgba(34,197,94,0.4)' }} />;
}

function ResourceBar({ pct, type }) {
  const color =
    type === 'mem'
      ? pct > 85 ? '#EF4444' : pct > 70 ? '#F59E0B' : '#3B82F6'
      : pct > 80 ? '#EF4444' : pct > 60 ? '#F59E0B' : '#22C55E';
  return (
    <div className="flex items-center gap-2">
      <div className="w-20 h-1.5 rounded-full bg-[#1A2235]">
        <div className="h-full rounded-full transition-all duration-700"
             style={{ width: `${Math.min(pct, 100)}%`, background: color }} />
      </div>
      <span className="font-mono text-xs text-[#94A3B8]">{pct.toFixed(1)}%</span>
    </div>
  );
}

function RestartBadge({ count }) {
  if (count === 0) return <span className="text-[#334155] text-xs font-mono">—</span>;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-mono text-xs font-bold border ${
      count >= 5
        ? 'bg-red-900/50 text-red-300 border-red-700'
        : count >= 3
        ? 'bg-amber-900/50 text-amber-300 border-amber-700'
        : 'bg-gray-800 text-gray-400 border-gray-700'
    }`}>
      ↺ {count}
    </span>
  );
}

// Pod name cell — shows truncated name with hover tooltip for long names
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
      <p className="font-mono text-xs text-white font-medium cursor-default"
         style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {name}
      </p>
      <p className="text-[#475569] text-[10px] mt-0.5">{namespace}</p>

      {isTruncated && tooltipVisible && (
        <div className="absolute left-0 top-full mt-1 rounded-lg border border-[#1E2D45] bg-[#0F1629] p-2.5 z-30 shadow-xl"
             style={{ minWidth: 'max-content', maxWidth: '18rem' }}>
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

const TABLE_HEAD = (
  <thead>
    <tr className="border-b border-[#1E2D45]">
      {['Status', 'Pod', 'CPU', 'Memory', 'Restarts', 'Age'].map(h => (
        <th key={h} className="px-4 py-2.5 text-left text-[10px] font-semibold text-[#475569] uppercase tracking-widest">{h}</th>
      ))}
    </tr>
  </thead>
);

function PodRows({ pods }) {
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

function Section({ icon, title, pods, defaultOpen }) {
  const [expanded, setExpanded] = useState(defaultOpen);
  const sorted = [...pods].sort((a, b) => (STATUS_ORDER[a.status] ?? 3) - (STATUS_ORDER[b.status] ?? 3));
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
        <span className={`ml-auto text-[#475569] text-xs transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}>▼</span>
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

export default function PodTable({ pods }) {
  const [filterNs, setFilterNs] = useState('all');

  if (!pods || pods.length === 0) {
    return (
      <div className="text-center py-8 text-[#475569] text-sm">
        <p>No pods found. Is Minikube running?</p>
        <code className="mt-2 block text-xs bg-[#0F1629] text-[#475569] px-2 py-1 rounded inline-block">minikube start</code>
      </div>
    );
  }

  const namespaces = ['all', ...new Set(pods.map(p => p.namespace))];
  const filtered   = filterNs === 'all' ? pods : pods.filter(p => p.namespace === filterNs);

  const campus = filtered.filter(p => p.namespace === 'campus');
  const system = filtered.filter(p => p.namespace !== 'campus');

  return (
    <div>
      {/* Namespace filter pills */}
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

      {campus.length > 0 && (
        <Section icon="📦" title="Campus Services" pods={campus} defaultOpen={true} />
      )}
      {system.length > 0 && (
        <Section icon="⚙️" title="System Pods" pods={system} defaultOpen={false} />
      )}
      {filtered.length === 0 && (
        <div className="px-4 py-6 text-center text-[#475569] text-sm">
          No pods in namespace <span className="font-mono text-[#94A3B8]">{filterNs}</span>
        </div>
      )}
    </div>
  );
}

StatusDot.propTypes    = { status: PropTypes.string };
ResourceBar.propTypes  = { pct: PropTypes.number.isRequired, type: PropTypes.string };
RestartBadge.propTypes = { count: PropTypes.number.isRequired };
PodNameCell.propTypes  = { name: PropTypes.string.isRequired, namespace: PropTypes.string };
PodRows.propTypes      = { pods: PropTypes.array.isRequired };
Section.propTypes      = { icon: PropTypes.string, title: PropTypes.string, pods: PropTypes.array, defaultOpen: PropTypes.bool };
PodTable.propTypes     = { pods: PropTypes.arrayOf(PropTypes.object) };
