import PropTypes from 'prop-types';
import { useCallback, useMemo, useRef, useEffect, useState } from 'react';
import ReactFlow, {
  Background, Controls, MiniMap,
  ReactFlowProvider, Handle, Position, useReactFlow,
} from 'reactflow';
import 'reactflow/dist/style.css';

// ── Design tokens ─────────────────────────────────────────────────────────────
const C = {
  critical: { border: '#DC2626', bg: '#1C0505', dot: '#EF4444', glow: 'rgba(239,68,68,0.2)', badge: '#7F1D1D', badgeText: '#FCA5A5' },
  warning:  { border: '#D97706', bg: '#1C1500', dot: '#F59E0B', glow: 'rgba(245,158,11,0.12)', badge: '#78350F', badgeText: '#FCD34D' },
  healthy:  { border: '#16A34A', bg: '#052E16', dot: '#22C55E', glow: 'rgba(34,197,94,0.12)', badge: '#052e16', badgeText: '#4ade80' },
};

const cpuBarColor = pct => pct > 80 ? '#EF4444' : pct > 60 ? '#F59E0B' : '#22C55E';
const memBarColor = pct => pct > 85 ? '#EF4444' : pct > 70 ? '#F59E0B' : '#3B82F6';

const NODE_W = 160;

function formatAge(minutes) {
  if (!minutes) return '—';
  if (minutes < 60)   return `${minutes}m`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
  return `${Math.floor(minutes / 1440)}d`;
}

// ── Metric bar ────────────────────────────────────────────────────────────────
function MetricBar({ label, pct, colorFn }) {
  const color = colorFn(pct ?? 0);
  return (
    <div style={{ marginBottom: 4 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 8.5, marginBottom: 2 }}>
        <span style={{ color: '#475569' }}>{label}</span>
        <span style={{ color: color, fontFamily: 'monospace', fontWeight: 600 }}>{(pct ?? 0).toFixed(0)}%</span>
      </div>
      <div style={{ height: 2, background: '#1A2235', borderRadius: 9999, overflow: 'hidden' }}>
        <div style={{
          height: '100%', width: `${Math.min(pct ?? 0, 100)}%`,
          background: color, borderRadius: 9999, transition: 'width 0.7s ease',
        }} />
      </div>
    </div>
  );
}
MetricBar.propTypes = { label: PropTypes.string, pct: PropTypes.number, colorFn: PropTypes.func };

// ── Custom pod node ───────────────────────────────────────────────────────────
function PodNode({ data }) {
  const c = C[data.status] ?? C.healthy;
  const isCrit = data.status === 'critical';
  const label = (data.label ?? '').length > 21
    ? (data.label ?? '').slice(0, 19) + '…'
    : (data.label ?? '');
  const restarts = data.restarts ?? 0;

  return (
    <div style={{
      width: NODE_W, position: 'relative',
      background: data.highlighted ? '#0c2040' : c.bg,
      border: `1.5px solid ${data.highlighted ? '#3b82f6' : c.border}`,
      borderRadius: 10,
      boxShadow: isCrit
        ? `0 0 18px ${c.glow}, inset 0 0 12px ${c.glow}`
        : data.highlighted
          ? '0 0 0 2px #3b82f644, 0 8px 32px #0009'
          : '0 2px 10px rgba(0,0,0,0.4)',
      opacity: data.dimmed ? 0.15 : 1,
      animation: isCrit ? 'glow-critical 2s ease-in-out infinite' : 'none',
      transition: 'opacity 0.18s ease, box-shadow 0.18s ease',
      cursor: 'pointer',
    }}>
      <div style={{ height: 3, background: `linear-gradient(90deg, ${c.border}, ${c.border}55)`, borderRadius: '10px 10px 0 0' }} />

      <Handle type="target" position={Position.Left}
        style={{ width: 9, height: 9, background: c.border, border: `2px solid #0A0F1E`, left: -5 }} />
      <Handle type="source" position={Position.Right}
        style={{ width: 9, height: 9, background: c.border, border: `2px solid #0A0F1E`, right: -5 }} />

      <div style={{ padding: '8px 10px 9px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 6 }}>
          <div className={isCrit ? 'animate-live' : ''}
               style={{ width: 6, height: 6, borderRadius: '50%', background: c.dot, flexShrink: 0, boxShadow: isCrit ? `0 0 5px ${c.dot}` : 'none' }} />
          <span style={{ fontSize: 11, fontWeight: 600, color: '#E2E8F0', fontFamily: "'JetBrains Mono', monospace", overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
            {label}
          </span>
        </div>
        <MetricBar label="CPU" pct={data.cpu_percent}    colorFn={cpuBarColor} />
        <MetricBar label="MEM" pct={data.memory_percent} colorFn={memBarColor} />
      </div>

      {restarts > 0 && (
        <div style={{
          position: 'absolute', top: -8, right: -8,
          background: restarts >= 5 ? '#DC2626' : '#D97706',
          borderRadius: 9999, padding: '1px 6px', fontSize: 9, color: 'white',
          fontWeight: 700, fontFamily: 'monospace',
          border: '1.5px solid #0A0F1E',
          boxShadow: restarts >= 5 ? '0 0 8px rgba(220,38,38,0.6)' : 'none',
        }}>
          ↺{restarts}
        </div>
      )}
    </div>
  );
}
PodNode.propTypes = { data: PropTypes.object };
const NODE_TYPES = { pod: PodNode };

// ── System pods panel ─────────────────────────────────────────────────────────
function SysPodsPanel({ sysPods }) {
  const [open, setOpen] = useState(false);
  if (!sysPods?.length) return null;

  const critCount = sysPods.filter(n => n.data?.status === 'critical').length;
  const warnCount = sysPods.filter(n => n.data?.status === 'warning').length;
  const accent = critCount > 0 ? '#DC2626' : warnCount > 0 ? '#D97706' : '#16A34A';

  return (
    <div style={{ position: 'absolute', top: 8, right: 8, zIndex: 10, background: '#0F1629', border: `1px solid ${accent}22`, borderRadius: 8, boxShadow: '0 4px 20px rgba(0,0,0,0.5)', minWidth: 128 }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%', padding: '5px 10px', cursor: 'pointer', background: 'none', border: 'none', color: '#475569', fontSize: 10 }}
      >
        <span style={{ color: accent, fontSize: 8 }}>●</span>
        <span style={{ fontWeight: 600, color: '#94A3B8' }}>System</span>
        <span style={{ background: '#1A2235', color: '#64748b', borderRadius: 99, padding: '0 5px', fontSize: 9 }}>{sysPods.length}</span>
        {(critCount > 0 || warnCount > 0) && (
          <span style={{ color: accent, fontSize: 9, fontWeight: 700 }}>{critCount > 0 ? `${critCount} crit` : `${warnCount} warn`}</span>
        )}
        <span style={{ marginLeft: 'auto', fontSize: 8, color: '#334155' }}>{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div style={{ padding: '2px 8px 8px', display: 'flex', flexWrap: 'wrap', gap: 3, maxWidth: 230 }}>
          {sysPods.map(n => {
            const sc = C[n.data?.status] ?? C.healthy;
            const short = n.id.replace(/-[a-z0-9]{4,}(-[a-z0-9]{4,})?$/, '');
            return (
              <span key={n.id} style={{ background: sc.border + '18', border: `1px solid ${sc.border}44`, borderRadius: 4, padding: '2px 6px', fontSize: 9, color: sc.badgeText, whiteSpace: 'nowrap' }}>{short}</span>
            );
          })}
        </div>
      )}
    </div>
  );
}
SysPodsPanel.propTypes = { sysPods: PropTypes.array };

// ── Graph legend ──────────────────────────────────────────────────────────────
function GraphLegend() {
  return (
    <div className="absolute top-3 left-3 z-10 rounded-lg border border-[#1E2D45] px-3 py-2.5"
         style={{ background: 'rgba(10,15,30,0.9)', backdropFilter: 'blur(4px)' }}>
      <p className="text-[#475569] text-[9px] font-semibold uppercase tracking-widest mb-2">Legend</p>
      <div className="space-y-1.5">
        {[
          { color: '#22C55E', border: '#16A34A', label: 'Healthy pod' },
          { color: '#F59E0B', border: '#D97706', label: 'Warning pod' },
          { color: '#EF4444', border: '#DC2626', label: 'Critical pod' },
          { color: '#64748B', border: '#334155', label: 'System pod'  },
        ].map(item => (
          <div key={item.label} className="flex items-center gap-2">
            <div style={{ width: 10, height: 10, borderRadius: 3, background: item.color + '20', border: `1.5px solid ${item.border}`, flexShrink: 0 }} />
            <span className="text-[#94A3B8] text-[9px]">{item.label}</span>
          </div>
        ))}
        <div className="flex items-center gap-2 pt-0.5 border-t border-[#1E2D45] mt-1">
          <div style={{ width: 10, height: 1.5, background: '#2563EB', flexShrink: 0 }} />
          <span className="text-[#94A3B8] text-[9px]">Service dependency</span>
        </div>
      </div>
    </div>
  );
}

// ── Slide-in pod detail drawer ────────────────────────────────────────────────
function PodDrawer({ pod, onClose }) {
  const c = C[pod.status] ?? C.healthy;
  const commands = [
    `kubectl logs ${pod.name} -n ${pod.namespace}${pod.restarts > 0 ? ' --previous' : ''}`,
    `kubectl describe pod ${pod.name} -n ${pod.namespace}`,
    `kubectl delete pod ${pod.name} -n ${pod.namespace}`,
  ];

  return (
    <div className="absolute right-0 top-0 h-full w-64 z-20 animate-slide-right border-l border-[#1E2D45] overflow-y-auto"
         style={{ background: '#0F1629' }}>

      {/* Header */}
      <div className="flex items-center justify-between px-3 py-3 border-b border-[#1E2D45] sticky top-0"
           style={{ background: '#0F1629' }}>
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
            pod.status === 'critical' ? 'bg-red-500 animate-live'
            : pod.status === 'warning' ? 'bg-amber-500'
            : 'bg-green-500'
          }`} />
          <span className="text-white font-semibold text-xs">Pod Details</span>
        </div>
        <button onClick={onClose}
                className="text-[#475569] hover:text-white transition-colors text-sm w-6 h-6 flex items-center justify-center rounded hover:bg-[#1A2235]">
          ✕
        </button>
      </div>

      {/* Pod name */}
      <div className="px-3 py-3 border-b border-[#1E2D45]">
        <p className="text-[#475569] text-[9px] uppercase tracking-widest mb-1">Pod Name</p>
        <p className="text-white font-mono text-[11px] break-all leading-relaxed">{pod.name}</p>
        <p className="text-[#475569] text-[10px] mt-1 font-mono">{pod.namespace}</p>
      </div>

      {/* Metrics */}
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
        <div className="flex items-center gap-2 px-2 py-1 rounded-md"
             style={{ background: c.bg, border: `1px solid ${c.border}` }}>
          <div className="w-1.5 h-1.5 rounded-full" style={{ background: c.dot }} />
          <span className="text-xs font-bold" style={{ color: c.dot }}>
            {(pod.status ?? 'healthy').toUpperCase()}
          </span>
        </div>
      </div>

      {/* Quick Commands */}
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

function CommandBlock({ cmd }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="mb-2 rounded-lg border border-[#1E2D45] bg-[#0A0F1E] overflow-hidden">
      <code className="block px-2 py-2 text-green-400 font-mono text-[9px] break-all leading-relaxed">
        {cmd}
      </code>
      <button
        onClick={() => navigator.clipboard.writeText(cmd).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); })}
        className={`w-full px-2 py-1 text-[9px] border-t border-[#1E2D45] transition-colors text-left ${
          copied ? 'text-green-400 bg-green-900/20' : 'text-[#475569] hover:text-white hover:bg-[#1A2235]'
        }`}
      >
        {copied ? '✓ Copied' : 'Copy ↗'}
      </button>
    </div>
  );
}
CommandBlock.propTypes = { cmd: PropTypes.string };

// ── Inner graph ───────────────────────────────────────────────────────────────
function GraphInner({ nodes, edges, pods, selectedPod, onPodSelect }) {
  const { fitView } = useReactFlow();
  const fittedRef  = useRef(false);
  const prevCount  = useRef(0);

  const [drawerPod, setDrawerPod] = useState(null);

  const campusNodes = useMemo(() => nodes.filter(n => !n.data?.isSys), [nodes]);
  const sysPods     = useMemo(() => nodes.filter(n =>  n.data?.isSys), [nodes]);

  useEffect(() => {
    if (campusNodes.length === 0 || fittedRef.current) return;
    fittedRef.current = true;
    const t = setTimeout(() => {
      const crits = campusNodes.filter(n => n.data?.status === 'critical');
      fitView({ nodes: crits.length > 0 ? crits.map(n => ({ id: n.id })) : undefined, padding: crits.length > 0 ? 0.85 : 0.22, duration: 750 });
    }, 350);
    return () => clearTimeout(t);
  }, [campusNodes.length, fitView]);

  useEffect(() => {
    if (campusNodes.length === 0 || campusNodes.length === prevCount.current) return;
    prevCount.current = campusNodes.length;
    if (!fittedRef.current) return;
    setTimeout(() => fitView({ padding: 0.22, duration: 600 }), 350);
  }, [campusNodes.length, fitView]);

  const handleNodeClick = useCallback((_, node) => {
    // Open drawer with full pod data
    const match = pods?.find(p =>
      p.name === node.id ||
      p.name.startsWith((node.data?.label ?? '').substring(0, 15))
    );
    setDrawerPod(match ?? {
      name:           node.data?.label || node.id,
      namespace:      node.data?.namespace || '—',
      status:         node.data?.status    || 'healthy',
      phase:          node.data?.phase     || 'Running',
      cpu_percent:    node.data?.cpu_percent    ?? 0,
      memory_percent: node.data?.memory_percent ?? 0,
      restarts:       node.data?.restarts       ?? 0,
      age_minutes:    node.data?.age_minutes     ?? 0,
    });
    // Also update cross-component highlight
    onPodSelect?.(selectedPod === node.id ? null : node.id);
  }, [pods, selectedPod, onPodSelect]);

  const styledNodes = useMemo(() => campusNodes.map(n => ({
    ...n, type: 'pod',
    data: { ...n.data, highlighted: selectedPod === n.id, dimmed: !!selectedPod && selectedPod !== n.id },
  })), [campusNodes, selectedPod]);

  const styledEdges = useMemo(() => edges.map(e => {
    const active    = !!selectedPod && (e.source === selectedPod || e.target === selectedPod);
    const isBlue    = e.style?.stroke === '#3b82f6';
    const newStroke = isBlue ? '#2563EB' : '#334155';
    return {
      ...e,
      style: { ...e.style, stroke: newStroke, strokeWidth: isBlue ? 1.5 : 1, opacity: selectedPod && !active ? 0.06 : 1 },
      markerEnd: e.markerEnd ? { ...e.markerEnd, color: newStroke } : e.markerEnd,
      animated: active && isBlue,
    };
  }), [edges, selectedPod]);

  if (!nodes || nodes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3">
        <div className="text-5xl" style={{ opacity: 0.08 }}>⎈</div>
        <div className="text-sm text-[#334155]">No pods — is Minikube running?</div>
        <code className="text-xs bg-[#0F1629] text-[#475569] px-3 py-1 rounded border border-[#1E2D45]">minikube start</code>
      </div>
    );
  }

  if (campusNodes.length === 0) {
    return <div className="flex items-center justify-center h-full text-[#334155] text-sm">No campus namespace services in graph</div>;
  }

  return (
    <div className="relative w-full h-full">
      <ReactFlow
        nodes={styledNodes}
        edges={styledEdges}
        nodeTypes={NODE_TYPES}
        onNodeClick={handleNodeClick}
        fitView
        fitViewOptions={{ padding: 0.25 }}
        minZoom={0.06}
        maxZoom={2.5}
        nodesDraggable
        nodesConnectable={false}
        panOnScroll
        panOnScrollMode="free"
        zoomOnScroll={false}
        zoomOnPinch
        defaultEdgeOptions={{ type: 'smoothstep' }}
        proOptions={{ hideAttribution: true }}
      >
        <Background color="#1E2D45" gap={24} size={1} />
        <Controls showInteractive={false}
          style={{ background: '#0F1629', border: '1px solid #1E2D45', borderRadius: 8 }} />
        <MiniMap
          nodeColor={n => C[n.data?.status]?.border ?? '#334155'}
          maskColor="#0A0F1Eaa"
          style={{ background: '#0F1629', border: '1px solid #1E2D45', borderRadius: 8 }}
          nodeStrokeWidth={0} zoomable pannable
        />
      </ReactFlow>

      <GraphLegend />
      <SysPodsPanel sysPods={sysPods} />

      {/* Slide-in drawer */}
      {drawerPod && (
        <PodDrawer pod={drawerPod} onClose={() => setDrawerPod(null)} />
      )}
    </div>
  );
}
GraphInner.propTypes = {
  nodes: PropTypes.array, edges: PropTypes.array, pods: PropTypes.array,
  selectedPod: PropTypes.string, onPodSelect: PropTypes.func,
};

export default function DependencyGraph({ nodes, edges, pods, selectedPod, onPodSelect }) {
  return (
    <ReactFlowProvider>
      <GraphInner nodes={nodes} edges={edges} pods={pods} selectedPod={selectedPod} onPodSelect={onPodSelect} />
    </ReactFlowProvider>
  );
}
DependencyGraph.propTypes = {
  nodes: PropTypes.array, edges: PropTypes.array, pods: PropTypes.array,
  selectedPod: PropTypes.string, onPodSelect: PropTypes.func,
};
