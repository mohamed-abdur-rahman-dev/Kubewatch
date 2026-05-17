/**
 * AnomalyCard.jsx — Individual anomaly event card rendered in the insights panel.
 *
 * Extracted from InsightPanel.jsx because:
 *   1. The anomaly card has 80+ lines of its own layout — too much for one file.
 *   2. Cards are individually clickable to cross-highlight graph nodes; that
 *      interaction logic is cleaner when the card owns its own onPodSelect call.
 *   3. Crash-rate calculation lives here because it's card-specific business logic.
 *
 * Props:
 *   anomaly     — AnomalyEvent from the API (pod, severity, issues[], cpu_percent, etc.)
 *   index       — 0-based position in the anomaly list (used for priority badge number)
 *   selectedPod — currently highlighted pod name from App-level state
 *   onPodSelect — callback to set selectedPod in App
 */
import PropTypes from 'prop-types';
import { RULE_LABELS } from '../../utils/constants';

/** Metric badge shown at the bottom of each card (CPU %, MEM %, restarts). */
function MetricBadge({ label, value, alert }) {
  return (
    <div
      className="flex items-center gap-1 px-2 py-0.5 rounded-md"
      style={{
        background: '#0A0F1E',
        border: `1px solid ${alert ? '#7F1D1D' : '#1E2D45'}`,
      }}
    >
      <span className="text-[#475569] text-[9px]">{label}</span>
      <span className={`font-mono text-[10px] font-bold ${alert ? 'text-red-400' : 'text-[#94A3B8]'}`}>
        {value}
      </span>
    </div>
  );
}
MetricBadge.propTypes = {
  label: PropTypes.string,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  alert: PropTypes.bool,
};

export default function AnomalyCard({ anomaly: a, index, selectedPod, onPodSelect }) {
  const isSelected = selectedPod === a.pod;

  // Crash rate only meaningful when pod has been running for at least an hour
  const showCrashRate = a.restarts > 0 && a.age_minutes >= 60;
  const crashRate     = showCrashRate
    ? (a.restarts / a.age_minutes * 60).toFixed(2)
    : null;
  const ageHours = Math.round(a.age_minutes / 60);

  return (
    <button
      onClick={() => onPodSelect?.(isSelected ? null : a.pod)}
      className={`w-full text-left animate-fadein mx-3 rounded-xl overflow-hidden transition-all duration-200 ${
        isSelected ? 'ring-2 ring-white/40 scale-[1.01]' : 'hover:scale-[1.005]'
      }`}
      style={{
        border:           `1px solid ${a.severity === 'critical' ? '#7F1D1D' : '#78350F'}`,
        background:       a.severity === 'critical' ? '#1C0505' : '#1C1200',
        animationDelay:   `${index * 60}ms`,
      }}
    >
      {/* Header strip: priority number + truncated pod name + severity badge */}
      <div
        className="flex items-center justify-between px-3 py-2 border-b"
        style={{ borderColor: a.severity === 'critical' ? '#7F1D1D' : '#78350F' }}
      >
        <div className="flex items-center gap-2">
          <div
            className="w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold text-white flex-shrink-0"
            style={{ background: a.severity === 'critical' ? '#DC2626' : '#D97706' }}
          >
            {index + 1}
          </div>
          <span className="text-white font-mono text-xs font-semibold truncate max-w-[160px]">
            {a.pod.length > 24 ? a.pod.substring(0, 24) + '…' : a.pod}
          </span>
        </div>
        <span
          className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${
            a.severity === 'critical'
              ? 'bg-red-900/50 text-red-300 border-red-700'
              : 'bg-amber-900/50 text-amber-300 border-amber-700'
          }`}
        >
          {a.severity.toUpperCase()}
        </span>
      </div>

      {/* Body: rule list + crash rate + metric badges */}
      <div className="px-3 py-2 space-y-1.5">
        {a.issues.map(issue => (
          <p
            key={issue}
            className="text-[11px] flex items-center gap-1.5"
            style={{ color: a.severity === 'critical' ? '#FCA5A5' : '#FCD34D' }}
          >
            <span>•</span>
            <span>{RULE_LABELS[issue] || issue}</span>
          </p>
        ))}

        {/* Crash rate block — only shown when pod is old enough to calculate a meaningful rate */}
        {showCrashRate && (
          <div
            className="flex items-center gap-1.5 py-1.5 px-2 rounded-md mt-1"
            style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)' }}
          >
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
}
AnomalyCard.propTypes = {
  anomaly:     PropTypes.object.isRequired,
  index:       PropTypes.number.isRequired,
  selectedPod: PropTypes.string,
  onPodSelect: PropTypes.func,
};
