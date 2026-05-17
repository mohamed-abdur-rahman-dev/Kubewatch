/**
 * DependencyGraph.jsx — React Flow canvas for visualising pod dependencies.
 *
 * Moved from: frontend/src/components/DependencyGraph.jsx
 * New location: apps/dashboard/src/components/graph/DependencyGraph.jsx
 *
 * Changes from the original:
 *   - GraphLegend extracted → ./GraphLegend.jsx
 *   - PodDrawer + CommandBlock extracted → ./NodeDrawer.jsx
 *   - STATUS_TOKENS imported from utils/constants (was inlined as `C`)
 *   - formatAge imported from utils/formatters (was inlined)
 *   - No logic was changed; only import paths and structural placement changed.
 *
 * Architecture note: This file owns the React Flow setup, custom node type,
 * the system-pods panel, and the fit-view logic. It does NOT own the drawer
 * or the legend — those are separate concerns in sibling files.
 */
import PropTypes from 'prop-types';
import { useCallback, useMemo, useRef, useEffect, useState } from 'react';
import ReactFlow, {
  Background, Controls, MiniMap,
  ReactFlowProvider, Handle, Position, useReactFlow,
} from 'reactflow';
import 'reactflow/dist/style.css';

import { STATUS_TOKENS } from '../../utils/constants';
import GraphLegend from './GraphLegend';
import { PodDrawer } from './NodeDrawer';

// Local aliases so existing JSX doesn't need to change
const C = STATUS_TOKENS;

const cpuBarColor = pct => pct > 80 ? '#EF4444' : pct > 60 ? '#F59E0B' : '#22C55E';
const memBarColor = pct => pct > 85 ? '#EF4444' : pct > 70 ? '#F59E0B' : '#3B82F6';

const NODE_W = 160;

// ── Metric bar ─────────────────────────────────────────────────────────────────
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

// ── Custom pod node ────────────────────────────────────────────────────────────
function PodNode({ data }) {
  const c      = C[data.status] ?? C.healthy;
  const isCrit = data.status === 'critical';
  const label  = (data.label ?? '').length > 21
    ? (data.label ?? '').slice(0, 19) + '…'
    : (data.label ?? '');
  const restarts = data.restarts ?? 0;

  return (
    <div style={{
      width: NODE_W, position: 'relative',
      background:  data.highlighted ? '#0c2040' : c.bg,
      border:      `1.5px solid ${data.highlighted ? '#3b82f6' : c.border}`,
      borderRadius: 10,
      boxShadow: isCrit
        ? `0 0 18px ${c.glow}, inset 0 0 12px ${c.glow}`
        : data.highlighted
          ? '0 0 0 2px #3b82f644, 0 8px 32px #0009'
          : '0 2px 10px rgba(0,0,0,0.4)',
      opacity:    data.dimmed ? 0.15 : 1,
      animation:  isCrit ? 'glow-critical 2s ease-in-out infinite' : 'none',
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
          <div
            className={isCrit ? 'animate-live' : ''}
            style={{ width: 6, height: 6, borderRadius: '50%', background: c.dot, flexShrink: 0, boxShadow: isCrit ? `0 0 5px ${c.dot}` : 'none' }}
          />
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

// ── System pods panel ──────────────────────────────────────────────────────────
function SysPodsPanel({ sysPods }) {
  const [open, setOpen] = useState(false);
  if (!sysPods?.length) return null;

  const critCount = sysPods.filter(n => n.data?.status === 'critical').length;
  const warnCount = sysPods.filter(n => n.data?.status === 'warning').length;
  const accent    = critCount > 0 ? '#DC2626' : warnCount > 0 ? '#D97706' : '#16A34A';

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
            const sc    = C[n.data?.status] ?? C.healthy;
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

// ── Inner graph (inside ReactFlowProvider) ─────────────────────────────────────
function GraphInner({ nodes, edges, pods, selectedPod, onPodSelect }) {
  const { fitView }  = useReactFlow();
  const fittedRef    = useRef(false);
  const prevCount    = useRef(0);
  const [drawerPod, setDrawerPod] = useState(null);

  const campusNodes = useMemo(() => nodes.filter(n => !n.data?.isSys), [nodes]);
  const sysPods     = useMemo(() => nodes.filter(n =>  n.data?.isSys), [nodes]);

  // Auto-fit on first data load; focus critical pods if any exist
  useEffect(() => {
    if (campusNodes.length === 0 || fittedRef.current) return;
    fittedRef.current = true;
    const t = setTimeout(() => {
      const crits = campusNodes.filter(n => n.data?.status === 'critical');
      fitView({
        nodes:   crits.length > 0 ? crits.map(n => ({ id: n.id })) : undefined,
        padding: crits.length > 0 ? 0.85 : 0.22,
        duration: 750,
      });
    }, 350);
    return () => clearTimeout(t);
  }, [campusNodes.length, fitView]);

  // Re-fit when pod count changes (new pods appeared or disappeared)
  useEffect(() => {
    if (campusNodes.length === 0 || campusNodes.length === prevCount.current) return;
    prevCount.current = campusNodes.length;
    if (!fittedRef.current) return;
    setTimeout(() => fitView({ padding: 0.22, duration: 600 }), 350);
  }, [campusNodes.length, fitView]);

  const handleNodeClick = useCallback((_, node) => {
    // Merge graph data with full pod data from the /pods endpoint for richer drawer info
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
      style:     { ...e.style, stroke: newStroke, strokeWidth: isBlue ? 1.5 : 1, opacity: selectedPod && !active ? 0.06 : 1 },
      markerEnd: e.markerEnd ? { ...e.markerEnd, color: newStroke } : e.markerEnd,
      animated:  active && isBlue,
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
