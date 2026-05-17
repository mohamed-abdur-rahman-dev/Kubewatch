import PropTypes from 'prop-types';
import { useState, useEffect, useCallback } from 'react';

const RULE_LABELS = {
  cpu_critical:    'CPU critical (>80%)',
  cpu_high:        'CPU elevated (>60%)',
  memory_critical: 'Memory critical (>85%)',
  memory_high:     'Memory elevated (>70%)',
  crash_looping:   'Crash-looping (5+ restarts)',
  restarting:      'Unstable — multiple restarts',
  not_running:     'Pod not in Running state',
  oom_risk:        'High OOM termination risk',
};

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

// ── Risk Dial (circular SVG gauge) ───────────────────────────────────────────
function RiskDial({ score }) {
  const color = score >= 75 ? '#ef4444' : score >= 50 ? '#f59e0b' : score >= 25 ? '#3b82f6' : '#22c55e';
  const label = score >= 75 ? 'CRITICAL' : score >= 50 ? 'HIGH' : score >= 25 ? 'MODERATE' : 'HEALTHY';
  const r = 30;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  return (
    <div className="flex flex-col items-center flex-shrink-0" title={`Risk score: ${score}/100`}>
      <svg width="76" height="76" viewBox="0 0 76 76">
        <circle cx="38" cy="38" r={r} fill="none" stroke="#1e293b" strokeWidth="7" />
        <circle cx="38" cy="38" r={r} fill="none" stroke={color} strokeWidth="7"
          strokeDasharray={circ} strokeDashoffset={offset}
          strokeLinecap="round" transform="rotate(-90 38 38)"
          style={{ transition: 'stroke-dashoffset 1.2s ease, stroke 0.5s ease' }} />
        <text x="38" y="42" textAnchor="middle" fill={color} fontSize="15" fontWeight="bold">{score}</text>
      </svg>
      <span className="text-[10px] font-bold -mt-0.5" style={{ color }}>{label}</span>
    </div>
  );
}

// ── Insight section block ─────────────────────────────────────────────────────
const InsightSection = ({ label, color, text }) => (
  <div>
    <p className="text-[10px] font-bold tracking-widest mb-1" style={{ color }}>{label}</p>
    <p className="text-[#94A3B8] text-xs leading-relaxed">
      {text || <span className="text-[#334155] italic">Analyzing...</span>}
    </p>
  </div>
);

// ── Skeleton loading state ────────────────────────────────────────────────────
function LoadingState({ loadingSeconds }) {
  return (
    <div className="space-y-3">
      <div>
        <span className="skeleton mb-2" style={{ width: '5rem', height: '0.625rem', display: 'block', marginBottom: '0.5rem' }} />
        <span className="skeleton mb-1" style={{ height: '0.75rem', width: '100%', display: 'block', marginBottom: '0.25rem' }} />
        <span className="skeleton" style={{ height: '0.75rem', width: '80%', display: 'block' }} />
      </div>
      <div>
        <span className="skeleton mb-2" style={{ width: '6rem', height: '0.625rem', display: 'block', marginBottom: '0.5rem' }} />
        <span className="skeleton mb-1" style={{ height: '0.75rem', width: '100%', display: 'block', marginBottom: '0.25rem' }} />
        <span className="skeleton" style={{ height: '0.75rem', width: '60%', display: 'block' }} />
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
            <p className="text-red-400/70 text-[10px]">
              Taking longer than usual ({loadingSeconds}s)
            </p>
            <p className="text-[#475569] text-[10px]">
              Switch to Cloud AI for instant results →
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Metric badge ──────────────────────────────────────────────────────────────
const MetricBadge = ({ label, value, alert }) => (
  <div className="flex items-center gap-1 px-2 py-0.5 rounded-md"
       style={{ background: '#0A0F1E', border: `1px solid ${alert ? '#7F1D1D' : '#1E2D45'}` }}>
    <span className="text-[#475569] text-[9px]">{label}</span>
    <span className={`font-mono text-[10px] font-bold ${alert ? 'text-red-400' : 'text-[#94A3B8]'}`}>
      {value}
    </span>
  </div>
);

// ── Copy button ───────────────────────────────────────────────────────────────
function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  const copy = useCallback(() => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [text]);
  return (
    <button
      onClick={copy}
      className={`flex-shrink-0 px-2.5 py-1 rounded-md text-[10px] font-medium transition-all duration-150 ${
        copied
          ? 'bg-green-800 text-green-300'
          : 'bg-[#1A2235] border border-[#1E2D45] text-[#94A3B8] hover:bg-[#1E2A40] hover:text-white'
      }`}
    >
      {copied ? '✓ Copied' : 'Copy'}
    </button>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function InsightPanel({
  insight, blastRadius, action,
  anomalies, loading, loadingSeconds, provider,
  onPodSelect, selectedPod, lastFetchTime,
  aiMode, setAiMode, openaiAvailable,
}) {
  const rcText = useTypewriter(loading ? '' : (insight  || ''), 16);
  const brText = useTypewriter(loading ? '' : (blastRadius || ''), 16);

  const riskScore = Math.min(100, Math.round(
    (anomalies ?? []).reduce((sum, a) => {
      const base       = a.severity === 'critical' ? 40 : 18;
      const restartBon = Math.min(a.restarts / 10, 1) * 22;
      const cpuBon     = (a.cpu_percent  / 100) * 10;
      const memBon     = (a.memory_percent / 100) * 10;
      return sum + base + restartBon + cpuBon + memBon;
    }, 0)
  ));

  const modelLabel = provider === 'openai'
    ? '⚡ OpenAI gpt-4o-mini · Cloud'
    : '🏠 Ollama llama3.2:1b · Local · auto-refresh';

  return (
    <div className="flex flex-col pb-3">

      {/* Panel header with AI toggle */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-[#1E2D45]">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded bg-blue-600/20 flex items-center justify-center">
            <span className="text-blue-400 text-xs">✦</span>
          </div>
          <h2 className="text-white font-semibold text-sm tracking-wide">AI INSIGHTS</h2>
        </div>

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
            title={!openaiAvailable ? 'Add OPENAI_API_KEY to backend/.env to enable Cloud AI' : 'Sends cluster metrics to OpenAI API'}
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

      {/* Provider mismatch notice */}
      {!loading && provider !== aiMode && (
        <div className="mx-3 mt-2 flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs text-amber-300"
             style={{ background: '#1C1200', border: '1px solid #78350F' }}>
          ⚠ {aiMode === 'openai' ? 'OpenAI unavailable' : 'Ollama unavailable'} — using {provider === 'ollama' ? 'Local AI' : 'Cloud AI'}
        </div>
      )}

      {/* Analysis card */}
      <div className="mx-3 mt-3 rounded-xl border border-[#1E2D45] bg-[#0F1629] overflow-hidden">
        {/* Card header with risk dial + tooltip */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#1E2D45]">
          <div className="flex items-center gap-2">
            <span className="text-base">🤖</span>
            <span className="text-white font-semibold text-sm">AI Analysis</span>
          </div>
          {/* Risk dial with hover tooltip */}
          <div className="relative group">
            <RiskDial score={riskScore} />
            <div className="hidden group-hover:block absolute right-0 top-full mt-2
                            w-52 rounded-xl border border-[#1E2D45] bg-[#0F1629] p-3
                            z-30 shadow-xl text-[10px]">
              <p className="text-white font-bold mb-2">Risk Score: {riskScore}/100</p>
              <div className="space-y-1.5">
                {anomalies.filter(a => a.severity === 'critical').length > 0 && (
                  <div className="flex justify-between">
                    <span className="text-[#94A3B8]">Critical pods</span>
                    <span className="text-red-400 font-mono font-bold">
                      +{anomalies.filter(a => a.severity === 'critical').length * 30}
                    </span>
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
                {anomalies.length === 0 && (
                  <p className="text-[#475569]">No active anomalies</p>
                )}
              </div>
              <div className="mt-2 pt-2 border-t border-[#1E2D45] flex justify-between">
                <span className="text-[#94A3B8]">Total</span>
                <span className="text-white font-mono font-bold">{riskScore}/100</span>
              </div>
              <p className="text-[#334155] text-[9px] mt-2 text-center">Hover away to close</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 space-y-3">
          {loading ? (
            <LoadingState loadingSeconds={loadingSeconds} />
          ) : (
            <>
              {insight && <InsightSection label="ROOT CAUSE"   color="#F59E0B" text={rcText} />}
              {blastRadius && <InsightSection label="BLAST RADIUS" color="#EF4444" text={brText} />}
              {!insight && !blastRadius && (
                <p className="text-[#334155] text-xs italic">Waiting for analysis…</p>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t border-[#162032] flex items-center justify-between">
          <span className="text-[#475569] text-[10px] font-mono">{modelLabel}</span>
          {provider === 'openai' && lastFetchTime && (
            <span className="text-[10px] text-[#334155]">
              Updated {timeSince(lastFetchTime)} · use ↺ to refresh
            </span>
          )}
        </div>
      </div>

      {/* Recommended Action */}
      {action && !loading && (
        <div className="mx-3 mt-3 rounded-xl border border-[#1E2D45] bg-[#0A0F1E] overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-2 border-b border-[#1E2D45]"
               style={{ background: '#0D1527' }}>
            <span className="text-amber-400 text-sm">⚡</span>
            <span className="text-white text-xs font-semibold tracking-wide">RECOMMENDED ACTION</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-3">
            <span className="text-[#334155] font-mono text-xs flex-shrink-0">$</span>
            <code className="text-green-400 font-mono text-xs flex-1 break-all">{action}</code>
            <CopyButton text={action} />
          </div>
        </div>
      )}

      {/* Anomaly cards */}
      <div className="mt-3 flex flex-col gap-2">
        {(!anomalies || anomalies.length === 0) ? (
          <div className="mx-3 rounded-xl border border-green-900/50 p-3 text-green-400 text-sm"
               style={{ background: '#052E16' }}>
            ✅ All pods healthy — no anomalies detected
          </div>
        ) : (
          anomalies.map((a, index) => {
            const isSelected = selectedPod === a.pod;
            const showCrashRate = a.restarts > 0 && a.age_minutes >= 60;
            const crashRate = showCrashRate
              ? (a.restarts / a.age_minutes * 60).toFixed(2)
              : null;
            const ageHours = Math.round(a.age_minutes / 60);

            return (
              <button
                key={a.pod}
                onClick={() => onPodSelect?.(isSelected ? null : a.pod)}
                className={`w-full text-left animate-fadein mx-3 rounded-xl overflow-hidden transition-all duration-200 ${
                  isSelected ? 'ring-2 ring-white/40 scale-[1.01]' : 'hover:scale-[1.005]'
                }`}
                style={{
                  border: `1px solid ${a.severity === 'critical' ? '#7F1D1D' : '#78350F'}`,
                  background: a.severity === 'critical' ? '#1C0505' : '#1C1200',
                  animationDelay: `${index * 60}ms`,
                }}
              >
                {/* Top strip */}
                <div className="flex items-center justify-between px-3 py-2 border-b"
                     style={{ borderColor: a.severity === 'critical' ? '#7F1D1D' : '#78350F' }}>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold text-white flex-shrink-0"
                         style={{ background: a.severity === 'critical' ? '#DC2626' : '#D97706' }}>
                      {index + 1}
                    </div>
                    <span className="text-white font-mono text-xs font-semibold truncate max-w-[160px]">
                      {a.pod.length > 24 ? a.pod.substring(0, 24) + '…' : a.pod}
                    </span>
                  </div>
                  <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${
                    a.severity === 'critical'
                      ? 'bg-red-900/50 text-red-300 border-red-700'
                      : 'bg-amber-900/50 text-amber-300 border-amber-700'
                  }`}>
                    {a.severity.toUpperCase()}
                  </span>
                </div>

                {/* Body */}
                <div className="px-3 py-2 space-y-1.5">
                  {a.issues.map(issue => (
                    <p key={issue} className="text-[11px] flex items-center gap-1.5"
                       style={{ color: a.severity === 'critical' ? '#FCA5A5' : '#FCD34D' }}>
                      <span>•</span>
                      <span>{RULE_LABELS[issue] || issue}</span>
                    </p>
                  ))}

                  {/* Crash rate — only when restarts > 0 and age > 60min */}
                  {showCrashRate && (
                    <div className="flex items-center gap-1.5 py-1.5 px-2 rounded-md mt-1"
                         style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)' }}>
                      <span className="text-red-400 text-xs">↺</span>
                      <span className="text-red-300 text-[10px]">Crashing ~{crashRate}x/hr</span>
                      <span className="text-[#475569] text-[10px]">
                        ({a.restarts} times over {ageHours}h)
                      </span>
                    </div>
                  )}

                  <div className="flex items-center gap-2 pt-1 flex-wrap">
                    <MetricBadge label="CPU" value={`${(a.cpu_percent ?? 0).toFixed(1)}%`}    alert={a.cpu_percent > 80} />
                    <MetricBadge label="MEM" value={`${(a.memory_percent ?? 0).toFixed(1)}%`} alert={a.memory_percent > 85} />
                    <MetricBadge label="↺"   value={a.restarts}                               alert={a.restarts >= 3} />
                  </div>

                  {isSelected && (
                    <p className="text-xs text-blue-300 pt-0.5 font-medium">
                      ↑ Highlighted in graph — click to deselect
                    </p>
                  )}
                </div>
              </button>
            );
          })
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

RiskDial.propTypes       = { score: PropTypes.number };
InsightSection.propTypes = { label: PropTypes.string, color: PropTypes.string, text: PropTypes.string };
LoadingState.propTypes   = { loadingSeconds: PropTypes.number };
MetricBadge.propTypes    = { label: PropTypes.string, value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]), alert: PropTypes.bool };
CopyButton.propTypes     = { text: PropTypes.string };
