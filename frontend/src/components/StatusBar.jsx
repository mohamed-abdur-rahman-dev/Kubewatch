import PropTypes from 'prop-types';

const Pill = ({ label, count, color }) => {
  const colors = {
    blue:  'bg-blue-500/15  text-blue-300  border-blue-500/30',
    green: 'bg-green-500/15 text-green-300 border-green-500/30',
    amber: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    red:   'bg-red-500/15   text-red-300   border-red-500/30',
  };
  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm font-medium ${colors[color]}`}>
      <span className="text-xs opacity-70">{label}</span>
      <span className="font-bold font-mono">{count}</span>
    </div>
  );
};

export default function StatusBar({ snapshot, lastUpdated, isLive }) {
  const timeStr = lastUpdated
    ? new Date(lastUpdated).toLocaleTimeString('en-US', { hour12: false })
    : '--:--:--';

  return (
    <header
      className="flex items-center justify-between px-5 py-3 border-b border-[#1E2D45] flex-shrink-0"
      style={{ background: 'linear-gradient(90deg, #0A0F1E 0%, #0D1527 100%)' }}
    >
      {/* Brand */}
      <div className="flex items-center gap-3">
        <div
          className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center"
          style={{ boxShadow: '0 0 14px rgba(37,99,235,0.5)' }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <line x1="7" y1="7" x2="17" y2="7"  stroke="white" strokeWidth="1.5" strokeOpacity="0.55"/>
            <line x1="7" y1="7" x2="12" y2="17" stroke="white" strokeWidth="1.5" strokeOpacity="0.55"/>
            <line x1="17" y1="7" x2="12" y2="17" stroke="white" strokeWidth="1.5" strokeOpacity="0.55"/>
            <circle cx="7"  cy="7"  r="3" fill="white"/>
            <circle cx="17" cy="7"  r="3" fill="white"/>
            <circle cx="12" cy="17" r="3" fill="white"/>
          </svg>
        </div>
        <div>
          <h1 className="text-white font-semibold text-sm leading-tight tracking-tight">Kubewatch</h1>
          <p className="text-[#3B5068] text-[10px] leading-none mt-0.5 tracking-wide">live pod monitoring</p>
        </div>
      </div>

      {/* Stats Pills */}
      <div className="flex items-center gap-2">
        <Pill label="Total"    count={snapshot?.total    ?? 0} color="blue"  />
        <Pill label="Healthy"  count={snapshot?.healthy  ?? 0} color="green" />
        <Pill label="Warning"  count={snapshot?.warning  ?? 0} color="amber" />
        <Pill label="Critical" count={snapshot?.critical ?? 0} color="red"   />
      </div>

      {/* Status & Time */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-[#0F1629] border border-[#1E2D45]">
          <div className={`w-1.5 h-1.5 rounded-full ${isLive ? 'bg-green-400 animate-live' : 'bg-red-400'}`} />
          <span className={`text-xs font-semibold font-mono ${isLive ? 'text-green-400' : 'text-red-400'}`}>
            {isLive ? 'LIVE' : 'OFFLINE'}
          </span>
        </div>
        <span className="text-[#475569] text-xs font-mono">{timeStr}</span>
      </div>
    </header>
  );
}

StatusBar.propTypes = {
  snapshot:    PropTypes.object,
  lastUpdated: PropTypes.string,
  isLive:      PropTypes.bool,
};

Pill.propTypes = {
  label: PropTypes.string,
  count: PropTypes.number,
  color: PropTypes.string,
};
