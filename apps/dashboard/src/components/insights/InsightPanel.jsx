/**
 * InsightPanel.jsx — AI analysis card + anomaly list for the right sidebar.
 *
 * Moved from: frontend/src/components/InsightPanel.jsx
 * New location: apps/dashboard/src/components/insights/InsightPanel.jsx
 *
 * Changes from the original:
 *   - RiskDial extracted → ./RiskDial.jsx
 *   - AnomalyCard extracted → ./AnomalyCard.jsx
 *   - ActionBlock extracted → ./ActionBlock.jsx
 *   - RULE_LABELS moved to utils/constants (was inlined here)
 *   - No logic was changed; only structural decomposition.
 *
 * This file owns: the AI toggle, provider mismatch banner,
 * the analysis card (loading state + insight text), and the anomaly list.
 */
import PropTypes from 'prop-types';
import { useState, useEffect } from 'react';

import RiskDial    from './RiskDial';
import AnomalyCard from './AnomalyCard';
import ActionBlock from './ActionBlock';

// ── Typewriter effect hook ─────────────────────────────────────────────────────
function useTypewriter(text, speed = 16) {
  const [displayed, setDisplayed] = useState('');
  useEffect(() => {
    setDisplayed('');
    if (!text) return;
    let i = 0;
    const timer = setInterval(() => {
      if (i < text.length) { setDisplayed(text.slice(0, i + 1)); i++; }
      else clearInterval(timer);
    }, speed);
    return () => clearInterval(timer);
  }, [text, speed]);
  return displayed;
}

function timeSince(ts) {
  if (!ts) return null;
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return `${s}s ago`;
  return `${Math.floor(s / 60)}m ago`;
}

// ── Insight section (root cause / blast radius) ────────────────────────────────
const InsightSection = ({ label, color, text }) => (
  <div>
    <p className="text-[10px] font-bold tracking-widest mb-1" style={{ color }}>{label}</p>
    <p className="text-[#94A3B8] text-xs leading-relaxed">
      {text || <span className="text-[#334155] italic">Analyzing...</span>}
    </p>
  </div>
);
InsightSection.propTypes = { label: PropTypes.string, color: PropTypes.string, text: PropTypes.string };

// ── Skeleton loading state ─────────────────────────────────────────────────────
function LoadingState({ loadingSeconds }) {
  return (
    <div className="space-y-3">
      <div>
        <span className="skeleton mb-2" style={{ width: '5rem', height: '0.625rem', display: 'block', marginBottom: '0.5rem' }} />
        <span className="skeleton mb-1" style={{ height: '0.75rem', width: '100%', display: 'block', marginBottom: '0.25rem' }} />
        <span className="skeleton"      style={{ height: '0.75rem', width: '80%',  display: 'block' }} />
      </div>
      <div>
        <span className="skeleton mb-2" style={{ width: '6rem', height: '0.625rem', display: 'block', marginBottom: '0.5rem' }} />
        <span className="skeleton mb-1" style={{ height: '0.75rem', width: '100%', display: 'block', marginBottom: '0.25rem' }} />
        <span className="skeleton"      style={{ height: '0.75rem', width: '60%',  display: 'block' }} />
      </div>
      <div className="pt-2 text-center">
        {loadingSeconds < 15 && (
          <p className="text-[#475569] text-[10px]">Local AI processing…</p>
        )}
        {loadingSeconds >= 15 && loadingSeconds < 45 && (
          <p className="text-amber-500/70 text-[10px]">
            Still thinking… ({loadingSeconds}s) · small model needs time
          </p>
        )}
        {loadingSeconds >= 45 && (
          <div className="space-y-1">
            <p className="text-red-400/70 text-[10px]">Taking longer than usual ({loadingSeconds}s)</p>
            <p className="text-[#475569] text-[10px]">Switch to Cloud AI for instant results →</p>
          </div>
        )}
      </div>
    </div>
  );
}
LoadingState.propTypes = { loadingSeconds: PropTypes.number };

// ── Main component ─────────────────────────────────────────────────────────────
export default function InsightPanel({
  insight, blastRadius, action,
  anomalies, loading, loadingSeconds, provider,
  onPodSelect, selectedPod, lastFetchTime,
  aiMode, setAiMode, openaiAvailable,
}) {
  const rcText = useTypewriter(loading ? '' : (insight     || ''), 16);
  const brText = useTypewriter(loading ? '' : (blastRadius || ''), 16);

  // Risk score: weighted sum across all anomalies, capped at 100
  const riskScore = Math.min(100, Math.round(
    (anomalies ?? []).reduce((sum, a) => {
      const base       = a.severity === 'critical' ? 40 : 18;
      const restartBon = Math.min(a.restarts / 10, 1) * 22;
      const cpuBon     = (a.cpu_percent   / 100) * 10;
      const memBon     = (a.memory_percent / 100) * 10;
      return sum + base + restartBon + cpuBon + memBon;
    }, 0)
  ));

  const modelLabel = provider === 'openai'
    ? '⚡ OpenAI gpt-4o-mini · Cloud'
    : '🏠 Ollama llama3.2:1b · Local · auto-refresh';

  return (
    <div className="flex flex-col pb-3">

      {/* Panel header with AI provider toggle */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-[#1E2D45]">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded bg-blue-600/20 flex items-center justify-center">
            <span className="text-blue-400 text-xs">✦</span>
          </div>
          <h2 className="text-white font-semibold text-sm tracking-wide">AI INSIGHTS</h2>
        </div>

        {/* Toggle: Local AI (free/private) vs Cloud AI (fast/costs money) */}
        <div className="flex items-center gap-1 p-1 rounded-lg bg-[#0A0F1E] border border-[#1E2D45]">
          <button
            onClick={() => setAiMode?.('ollama')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-200 ${
              aiMode === 'ollama'
                ? 'bg-green-600 text-white shadow-sm'
                : 'text-[#94A3B8] hover:text-white hover:bg-[#1A2235]'
            }`}
          >
            <span>🏠</span>
            <span>Local AI</span>
            {aiMode === 'ollama' && <span className="text-[9px] opacity-70 ml-0.5">Free</span>}
          </button>
          <button
            onClick={() => openaiAvailable && setAiMode?.('openai')}
            disabled={!openaiAvailable}
            title={!openaiAvailable ? 'Add OPENAI_API_KEY to apps/ai-service/.env to enable Cloud AI' : 'Sends cluster metrics to OpenAI API'}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-200 ${
              aiMode === 'openai'
                ? 'bg-blue-600 text-white shadow-sm'
                : !openaiAvailable
                ? 'text-[#334155] cursor-not-allowed'
                : 'text-[#94A3B8] hover:text-white hover:bg-[#1A2235]'
            }`}
          >
            <span>⚡</span>
            <span>Cloud AI</span>
            {aiMode === 'openai' && <span className="text-[9px] opacity-70 ml-0.5">GPT-4o</span>}
            {!openaiAvailable && <span className="ml-0.5 text-[9px]">🔒</span>}
          </button>
        </div>
      </div>

      {/* Provider mismatch — shown when requested provider is unavailable */}
      {!loading && provider !== aiMode && (
        <div className="mx-3 mt-2 flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs text-amber-300"
             style={{ background: '#1C1200', border: '1px solid #78350F' }}>
          ⚠ {aiMode === 'openai' ? 'OpenAI unavailable' : 'Ollama unavailable'} — using {provider === 'ollama' ? 'Local AI' : 'Cloud AI'}
        </div>
      )}

      {/* Analysis card */}
      <div className="mx-3 mt-3 rounded-xl border border-[#1E2D45] bg-[#0F1629] overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#1E2D45]">
          <div className="flex items-center gap-2">
            <span className="text-base">🤖</span>
            <span className="text-white font-semibold text-sm">AI Analysis</span>
          </div>
          {/* Risk dial with hover tooltip showing score breakdown */}
          <div className="relative group">
            <RiskDial score={riskScore} />
            <div className="hidden group-hover:block absolute right-0 top-full mt-2 w-52 rounded-xl border border-[#1E2D45] bg-[#0F1629] p-3 z-30 shadow-xl text-[10px]">
              <p className="text-white font-bold mb-2">Risk Score: {riskScore}/100</p>
              <div className="space-y-1.5">
                {anomalies.filter(a => a.severity === 'critical').length > 0 && (
                  <div className="flex justify-between">
                    <span className="text-[#94A3B8]">Critical pods</span>
                    <span className="text-red-400 font-mono font-bold">+{anomalies.filter(a => a.severity === 'critical').length * 30}</span>
                  </div>
                )}
                {anomalies.some(a => a.issues?.includes('crash_looping')) && (
                  <div className="flex justify-between">
                    <span className="text-[#94A3B8]">Crash-looping</span>
                    <span className="text-orange-400 font-mono font-bold">+25</span>
                  </div>
                )}
                {anomalies.some(a => a.restarts >= 3) && (
                  <div className="flex justify-between">
                    <span className="text-[#94A3B8]">High restarts</span>
                    <span className="text-amber-400 font-mono font-bold">+10</span>
                  </div>
                )}
                {anomalies.length === 0 && <p className="text-[#475569]">No active anomalies</p>}
              </div>
              <div className="mt-2 pt-2 border-t border-[#1E2D45] flex justify-between">
                <span className="text-[#94A3B8]">Total</span>
                <span className="text-white font-mono font-bold">{riskScore}/100</span>
              </div>
              <p className="text-[#334155] text-[9px] mt-2 text-center">Hover away to close</p>
            </div>
          </div>
        </div>

        <div className="p-4 space-y-3">
          {loading ? (
            <LoadingState loadingSeconds={loadingSeconds} />
          ) : (
            <>
              {insight     && <InsightSection label="ROOT CAUSE"   color="#F59E0B" text={rcText} />}
              {blastRadius && <InsightSection label="BLAST RADIUS" color="#EF4444" text={brText} />}
              {!insight && !blastRadius && (
                <p className="text-[#334155] text-xs italic">Waiting for analysis…</p>
              )}
            </>
          )}
        </div>

        <div className="px-4 py-2 border-t border-[#162032] flex items-center justify-between">
          <span className="text-[#475569] text-[10px] font-mono">{modelLabel}</span>
          {provider === 'openai' && lastFetchTime && (
            <span className="text-[10px] text-[#334155]">
              Updated {timeSince(lastFetchTime)} · use ↺ to refresh
            </span>
          )}
        </div>
      </div>

      {/* Recommended kubectl command (from AI) */}
      {!loading && <ActionBlock action={action} />}

      {/* Anomaly cards */}
      <div className="mt-3 flex flex-col gap-2">
        {(!anomalies || anomalies.length === 0) ? (
          <div className="mx-3 rounded-xl border border-green-900/50 p-3 text-green-400 text-sm"
               style={{ background: '#052E16' }}>
            ✅ All pods healthy — no anomalies detected
          </div>
        ) : (
          anomalies.map((a, index) => (
            <AnomalyCard
              key={a.pod}
              anomaly={a}
              index={index}
              selectedPod={selectedPod}
              onPodSelect={onPodSelect}
            />
          ))
        )}
      </div>
    </div>
  );
}
InsightPanel.propTypes = {
  insight:         PropTypes.string,
  blastRadius:     PropTypes.string,
  action:          PropTypes.string,
  anomalies:       PropTypes.arrayOf(PropTypes.object),
  loading:         PropTypes.bool,
  loadingSeconds:  PropTypes.number,
  provider:        PropTypes.string,
  onPodSelect:     PropTypes.func,
  selectedPod:     PropTypes.string,
  lastFetchTime:   PropTypes.number,
  aiMode:          PropTypes.string,
  setAiMode:       PropTypes.func,
  openaiAvailable: PropTypes.bool,
};
