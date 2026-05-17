import { useState, useEffect } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const POLL_INTERVAL = 15000;

export const NODE_W = 160;
export const NODE_H = 74;

const COL_GAP = 70;
const ROW_GAP = 14;

// BFS rank-based layout — no external dependency, deterministic
function computeLayout(nodes, edges) {
  if (!nodes.length) return [];

  const outMap = Object.fromEntries(nodes.map(n => [n.id, []]));
  const inMap  = Object.fromEntries(nodes.map(n => [n.id, []]));
  edges.forEach(e => {
    outMap[e.source]?.push(e.target);
    inMap[e.target]?.push(e.source);
  });

  // Assign rank: roots (no in-edges) = 0, their targets = 1, etc.
  const rank = {};
  const roots = nodes.filter(n => inMap[n.id].length === 0).map(n => n.id);
  if (roots.length === 0) nodes.forEach(n => { rank[n.id] = 0; });
  else roots.forEach(id => { rank[id] = 0; });

  const queue = [...roots];
  let head = 0;
  while (head < queue.length) {
    const id = queue[head++];
    (outMap[id] || []).forEach(tgt => {
      if (rank[tgt] === undefined || rank[tgt] < rank[id] + 1) {
        rank[tgt] = rank[id] + 1;
        queue.push(tgt);
      }
    });
  }
  nodes.forEach(n => { if (rank[n.id] === undefined) rank[n.id] = 0; });

  // Group by rank column, sort critical → warning → healthy within each column
  const byRank = {};
  nodes.forEach(n => { (byRank[rank[n.id]] = byRank[rank[n.id]] || []).push(n); });
  const pri = { critical: 0, warning: 1, healthy: 2 };
  Object.values(byRank).forEach(col =>
    col.sort((a, b) => (pri[a.data?.status] ?? 2) - (pri[b.data?.status] ?? 2))
  );

  // Center each column vertically
  const positioned = [];
  Object.entries(byRank).forEach(([r, col]) => {
    const totalH = col.length * NODE_H + Math.max(0, col.length - 1) * ROW_GAP;
    col.forEach((n, i) => {
      positioned.push({
        ...n,
        position: {
          x: Number(r) * (NODE_W + COL_GAP),
          y: -totalH / 2 + i * (NODE_H + ROW_GAP),
        },
      });
    });
  });

  return positioned;
}

export default function useGraph(refreshTrigger = 0) {
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function fetchGraph() {
      try {
        const res = await fetch(`${API_URL}/graph`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (cancelled) return;

        const rawNodes = data.nodes || [];
        const rawEdges = data.edges || [];

        const nodeIdSet = new Set(rawNodes.map(n => n.id));
        const validEdges = rawEdges.filter(
          e => nodeIdSet.has(e.source) && nodeIdSet.has(e.target)
        );

        const campus = rawNodes.filter(n => n.data?.namespace === 'campus');
        const sys    = rawNodes.filter(n => n.data?.namespace !== 'campus');

        const campusIds = new Set(campus.map(n => n.id));
        const campusEdges = validEdges.filter(
          e => campusIds.has(e.source) && campusIds.has(e.target)
        );

        const layouted = computeLayout(campus, campusEdges).map(n => ({
          ...n, data: { ...n.data, isSys: false },
        }));

        const sysNodes = sys.map(n => ({
          ...n, position: { x: 0, y: 0 }, data: { ...n.data, isSys: true },
        }));

        const mappedEdges = campusEdges.map(e => ({
          id: e.id,
          source: e.source,
          target: e.target,
          type: 'smoothstep',
          style: e.type === 'label_match'
            ? { stroke: '#3b82f6', strokeWidth: 2 }
            : { stroke: '#334155', strokeWidth: 1.5, strokeDasharray: '5,4' },
          markerEnd: {
            type: 'arrowclosed',
            color: e.type === 'label_match' ? '#3b82f6' : '#334155',
            width: 14, height: 14,
          },
          animated: false,
        }));

        setNodes([...layouted, ...sysNodes]);
        setEdges(mappedEdges);
      } catch (err) {
        console.error('useGraph fetch failed:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchGraph();
    const id = setInterval(fetchGraph, POLL_INTERVAL);
    return () => { cancelled = true; clearInterval(id); };
  }, [refreshTrigger]);

  return { nodes, edges, loading };
}
