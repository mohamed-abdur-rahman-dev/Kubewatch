/**
 * RiskDial.jsx — Circular SVG gauge showing cluster risk score 0–100.
 *
 * Extracted from InsightPanel.jsx because:
 *   1. SVG math (circumference, dashoffset) is unrelated to insight text rendering.
 *   2. The dial is independently reusable in a future summary card or modal.
 *   3. Keeps InsightPanel focused on text and anomaly layout.
 *
 * Score thresholds:
 *   75–100 → CRITICAL (red)
 *   50–74  → HIGH (amber)
 *   25–49  → MODERATE (blue)
 *   0–24   → HEALTHY (green)
 */
import PropTypes from 'prop-types';

export default function RiskDial({ score }) {
  const color =
    score >= 75 ? '#ef4444'
    : score >= 50 ? '#f59e0b'
    : score >= 25 ? '#3b82f6'
    : '#22c55e';

  const label =
    score >= 75 ? 'CRITICAL'
    : score >= 50 ? 'HIGH'
    : score >= 25 ? 'MODERATE'
    : 'HEALTHY';

  const r      = 30;
  const circ   = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;

  return (
    <div className="flex flex-col items-center flex-shrink-0" title={`Risk score: ${score}/100`}>
      <svg width="76" height="76" viewBox="0 0 76 76">
        {/* Background track */}
        <circle cx="38" cy="38" r={r} fill="none" stroke="#1e293b" strokeWidth="7" />
        {/* Filled arc — animates smoothly when score changes */}
        <circle
          cx="38" cy="38" r={r}
          fill="none"
          stroke={color}
          strokeWidth="7"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform="rotate(-90 38 38)"
          style={{ transition: 'stroke-dashoffset 1.2s ease, stroke 0.5s ease' }}
        />
        <text x="38" y="42" textAnchor="middle" fill={color} fontSize="15" fontWeight="bold">
          {score}
        </text>
      </svg>
      <span className="text-[10px] font-bold -mt-0.5" style={{ color }}>{label}</span>
    </div>
  );
}
RiskDial.propTypes = { score: PropTypes.number };
