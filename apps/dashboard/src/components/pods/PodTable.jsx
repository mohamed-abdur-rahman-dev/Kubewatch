/**
 * PodTable.jsx — Live pod health table with namespace filtering and sections.
 *
 * Moved from: frontend/src/components/PodTable.jsx
 * New location: apps/dashboard/src/components/pods/PodTable.jsx
 *
 * Changes from the original:
 *   - PodRows + sub-components extracted → ./PodRow.jsx
 *   - NamespaceFilter + Section extracted → ./NamespaceFilter.jsx
 *   - formatAge imported from utils/formatters (was inlined)
 *   - STATUS_ORDER imported from utils/constants (was inlined)
 *   - No logic was changed; this file now orchestrates its sub-components.
 *
 * Layout: namespace filter pills at top → campus section → system section.
 * campus pods default-open; system pods default-collapsed (less relevant for devs).
 */
import PropTypes from 'prop-types';
import { useState } from 'react';
import { NamespaceFilter, Section } from './NamespaceFilter';

export default function PodTable({ pods }) {
  const [filterNs, setFilterNs] = useState('all');

  if (!pods || pods.length === 0) {
    return (
      <div className="text-center py-8 text-[#475569] text-sm">
        <p>No pods found. Is Minikube running?</p>
        <code className="mt-2 block text-xs bg-[#0F1629] text-[#475569] px-2 py-1 rounded inline-block">
          minikube start
        </code>
      </div>
    );
  }

  const filtered = filterNs === 'all' ? pods : pods.filter(p => p.namespace === filterNs);
  // Campus section: user-deployed apps. System section: kube-system, monitoring, etc.
  const campus   = filtered.filter(p => p.namespace === 'campus');
  const system   = filtered.filter(p => p.namespace !== 'campus');

  return (
    <div>
      <NamespaceFilter pods={pods} filterNs={filterNs} setFilterNs={setFilterNs} />

      {campus.length > 0 && (
        <Section icon="📦" title="Campus Services" pods={campus} defaultOpen={true} />
      )}
      {system.length > 0 && (
        <Section icon="⚙️" title="System Pods" pods={system} defaultOpen={false} />
      )}
      {filtered.length === 0 && (
        <div className="px-4 py-6 text-center text-[#475569] text-sm">
          No pods in namespace <span className="font-mono text-[#94A3B8]">{filterNs}</span>
        </div>
      )}
    </div>
  );
}
PodTable.propTypes = { pods: PropTypes.arrayOf(PropTypes.object) };
