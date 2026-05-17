/**
 * GraphLegend.jsx — Static overlay explaining node and edge colors.
 *
 * Extracted from DependencyGraph.jsx because:
 *   1. The legend has zero logic — it's pure display data.
 *   2. Keeping it in its own file makes it trivially replaceable/hideable.
 *   3. DependencyGraph.jsx stays focused on graph mechanics.
 *
 * Position: absolute top-left inside the graph container.
 * Styling: matches the dark-navy design system; no external props needed.
 */
export default function GraphLegend() {
  return (
    <div
      className="absolute top-3 left-3 z-10 rounded-lg border border-[#1E2D45] px-3 py-2.5"
      style={{ background: 'rgba(10,15,30,0.9)', backdropFilter: 'blur(4px)' }}
    >
      <p className="text-[#475569] text-[9px] font-semibold uppercase tracking-widest mb-2">
        Legend
      </p>
      <div className="space-y-1.5">
        {[
          { color: '#22C55E', border: '#16A34A', label: 'Healthy pod' },
          { color: '#F59E0B', border: '#D97706', label: 'Warning pod' },
          { color: '#EF4444', border: '#DC2626', label: 'Critical pod' },
          { color: '#64748B', border: '#334155', label: 'System pod'  },
        ].map(item => (
          <div key={item.label} className="flex items-center gap-2">
            <div
              style={{
                width: 10, height: 10, borderRadius: 3,
                background: item.color + '20',
                border: `1.5px solid ${item.border}`,
                flexShrink: 0,
              }}
            />
            <span className="text-[#94A3B8] text-[9px]">{item.label}</span>
          </div>
        ))}
        {/* Edge type legend — solid = service dependency, dashed = namespace group */}
        <div className="flex items-center gap-2 pt-0.5 border-t border-[#1E2D45] mt-1">
          <div style={{ width: 10, height: 1.5, background: '#2563EB', flexShrink: 0 }} />
          <span className="text-[#94A3B8] text-[9px]">Service dependency</span>
        </div>
      </div>
    </div>
  );
}
