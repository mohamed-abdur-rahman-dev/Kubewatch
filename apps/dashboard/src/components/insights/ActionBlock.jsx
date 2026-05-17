/**
 * ActionBlock.jsx — Displays the AI-recommended kubectl command with a copy button.
 *
 * Extracted from InsightPanel.jsx because:
 *   1. The copy-to-clipboard interaction has its own state lifecycle.
 *   2. The block is reusable anywhere a kubectl command needs to be displayed.
 *   3. InsightPanel shouldn't manage copy state alongside AI text state.
 *
 * Shown below the AI analysis card when `action` is non-empty and not loading.
 */
import PropTypes from 'prop-types';
import { useState, useCallback } from 'react';

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
CopyButton.propTypes = { text: PropTypes.string };

export default function ActionBlock({ action }) {
  if (!action) return null;

  return (
    <div className="mx-3 mt-3 rounded-xl border border-[#1E2D45] bg-[#0A0F1E] overflow-hidden">
      <div
        className="flex items-center gap-2 px-3 py-2 border-b border-[#1E2D45]"
        style={{ background: '#0D1527' }}
      >
        <span className="text-amber-400 text-sm">⚡</span>
        <span className="text-white text-xs font-semibold tracking-wide">RECOMMENDED ACTION</span>
      </div>
      <div className="flex items-center gap-2 px-3 py-3">
        <span className="text-[#334155] font-mono text-xs flex-shrink-0">$</span>
        <code className="text-green-400 font-mono text-xs flex-1 break-all">{action}</code>
        <CopyButton text={action} />
      </div>
    </div>
  );
}
ActionBlock.propTypes = { action: PropTypes.string };
