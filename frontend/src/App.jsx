import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import usePods from './hooks/usePods';
import useInsights from './hooks/useInsights';
import useGraph from './hooks/useGraph';
import useConfig from './hooks/useConfig';

import StatusBar from './components/StatusBar';
import DependencyGraph from './components/DependencyGraph';
import InsightPanel from './components/InsightPanel';
import PodTable from './components/PodTable';

const RIGHT_MIN = 300;
const RIGHT_MAX = 860;
const RIGHT_DEFAULT = 480;

// ── Drag handle between graph and right panel ──────────────────────────────────
function ResizeHandle({ onDragStart, isDragging }) {
  return (
    <div
      onMouseDown={onDragStart}
      title="Drag to resize panels"
      style={{
        width: 6,
        flexShrink: 0,
        cursor: 'col-resize',
        position: 'relative',
        zIndex: 20,
        background: isDragging ? 'rgba(59,130,246,0.12)' : 'transparent',
        transition: 'background 0.15s',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      className="group"
    >
      {/* The visible 1px line */}
      <div style={{
        width: 1,
        height: '100%',
        position: 'absolute',
        background: isDragging ? '#3b82f6' : '#1E2D45',
        transition: 'background 0.15s',
      }} className="group-hover:!bg-blue-500" />

      {/* Grip dots — centered, visible on hover/drag */}
      <div style={{
        position: 'absolute',
        display: 'flex',
        flexDirection: 'column',
        gap: 3,
        opacity: isDragging ? 1 : 0,
        transition: 'opacity 0.15s',
        pointerEvents: 'none',
      }} className="group-hover:!opacity-100">
        {[0,1,2,3,4].map(i => (
          <div key={i} style={{
            width: 3, height: 3, borderRadius: '50%',
            background: isDragging ? '#3b82f6' : '#475569',
          }} />
        ))}
      </div>
    </div>
  );
}

export default function App() {
  const config = useConfig();

  const [aiMode, setAiMode] = useState('ollama');
  const userChoseRef = useRef(false);
  useEffect(() => {
    if (!userChoseRef.current) setAiMode(config.default_provider);
  }, [config.default_provider]);
  const handleAiMode = (m) => { userChoseRef.current = true; setAiMode(m); };

  const [lastRefresh, setLastRefresh] = useState(0);
  const refresh = () => setLastRefresh(Date.now());

  const { pods, snapshot, loading: podsLoading, error: podsError } = usePods(lastRefresh);
  const {
    insight, blastRadius, action, anomalies,
    provider: activeProvider, loading: insightLoading, lastFetchTime, loadingSeconds,
  } = useInsights(aiMode, lastRefresh);
  const { nodes, edges, loading: graphLoading } = useGraph(lastRefresh);

  const [selectedPod, setSelectedPod] = useState(null);

  // ── Horizontal resize state ────────────────────────────────────────────────
  const [rightWidth, setRightWidth] = useState(RIGHT_DEFAULT);
  const dragging    = useRef(false);
  const startX      = useRef(0);
  const startWidth  = useRef(0);
  const [isDragging, setIsDragging] = useState(false);

  const handleDragStart = useCallback((e) => {
    e.preventDefault();
    dragging.current   = true;
    startX.current     = e.clientX;
    startWidth.current = rightWidth;
    setIsDragging(true);
    document.body.style.cursor     = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [rightWidth]);

  useEffect(() => {
    const onMove = (e) => {
      if (!dragging.current) return;
      // Dragging left  → handle moves left  → right panel gets wider
      // Dragging right → handle moves right → right panel gets narrower
      const delta  = startX.current - e.clientX;
      const newW   = Math.max(RIGHT_MIN, Math.min(RIGHT_MAX, startWidth.current + delta));
      setRightWidth(newW);
    };
    const onUp = () => {
      if (!dragging.current) return;
      dragging.current               = false;
      setIsDragging(false);
      document.body.style.cursor     = '';
      document.body.style.userSelect = '';
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup',   onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup',   onUp);
    };
  }, []);

  const isLive         = !podsError;
  const lastUpdated    = new Date().toISOString();
  const namespaceCount = useMemo(
    () => [...new Set(pods.map(p => p.namespace))].length,
    [pods],
  );

  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{ background: '#0A0F1E' }}>

      <StatusBar snapshot={snapshot} lastUpdated={lastUpdated} isLive={isLive} />

      <div className="flex flex-1 overflow-hidden">

        {/* Left — Dependency Graph (fills remaining width) */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#1E2D45] flex-shrink-0">
            <span className="text-[#94A3B8] text-xs font-semibold tracking-widest uppercase">
              Dependency Graph
            </span>
            {selectedPod ? (
              <span className="text-xs text-blue-400 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse inline-block" />
                {selectedPod}
                <button onClick={() => setSelectedPod(null)} className="text-[#475569] hover:text-white ml-1">✕</button>
              </span>
            ) : (
              <span className="text-[#334155] text-[10px]">Scroll to pan · pinch to zoom · drag to move</span>
            )}
          </div>
          <div className="flex-1 min-h-0 relative">
            {graphLoading && nodes.length === 0 ? (
              <div className="flex items-center justify-center h-full text-[#334155] text-sm animate-pulse">Loading graph...</div>
            ) : (
              <DependencyGraph nodes={nodes} edges={edges} pods={pods} selectedPod={selectedPod} onPodSelect={setSelectedPod} />
            )}
          </div>
        </div>

        {/* Draggable resize handle */}
        <ResizeHandle onDragStart={handleDragStart} isDragging={isDragging} />

        {/* Right — AI Insights + Live Pod Health (resizable width) */}
        <div
          className="flex flex-col overflow-hidden flex-shrink-0"
          style={{ width: rightWidth }}
        >
          {/* AI Insights — top half */}
          <div className="flex-shrink-0 border-b border-[#1E2D45] overflow-y-auto" style={{ maxHeight: '55%' }}>
            <InsightPanel
              insight={insight} blastRadius={blastRadius} action={action}
              anomalies={anomalies} loading={insightLoading}
              loadingSeconds={loadingSeconds} provider={activeProvider}
              selectedPod={selectedPod} onPodSelect={setSelectedPod}
              lastFetchTime={lastFetchTime} aiMode={aiMode}
              setAiMode={handleAiMode} openaiAvailable={config.openai_available}
            />
          </div>

          {/* Live Pod Health — bottom half */}
          <div className="flex-1 overflow-hidden flex flex-col">
            <div
              className="flex items-center justify-between px-4 py-2.5 border-b border-[#1E2D45] flex-shrink-0 sticky top-0 z-10"
              style={{ background: '#0F1629' }}
            >
              <span className="text-[#94A3B8] text-xs font-semibold tracking-widest uppercase">
                Live Pod Health
              </span>
              <div className="flex items-center gap-2">
                <span className="text-[#334155] text-[10px]">
                  {snapshot?.total ?? 0} pods · {namespaceCount} ns
                </span>
                <button
                  onClick={refresh}
                  className="p-1 rounded hover:bg-[#1A2235] text-[#475569] hover:text-white transition-colors"
                  title="Force refresh"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/>
                    <path d="M21 3v5h-5"/>
                    <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/>
                    <path d="M8 16H3v5"/>
                  </svg>
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto pb-4">
              {podsLoading && pods.length === 0 ? (
                <div className="text-center py-8 text-[#334155] animate-pulse text-sm">Connecting to cluster...</div>
              ) : (
                <PodTable pods={pods} />
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
