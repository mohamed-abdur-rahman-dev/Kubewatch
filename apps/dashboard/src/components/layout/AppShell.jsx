/**
 * AppShell.jsx — Top-level layout wrapper for the dashboard.
 *
 * New file (did not exist before the monorepo restructure).
 *
 * Why this exists:
 *   App.jsx previously contained both business logic (state, hooks) and layout
 *   markup (the full-height dark container). AppShell extracts the layout shell
 *   so that:
 *     1. The dark background + flex-column layout is defined once and reusable
 *        if a second page (e.g. /settings) is ever added.
 *     2. App.jsx stays focused on wiring hooks to components, not markup.
 *     3. A future router can wrap each page in AppShell without duplicating styles.
 *
 * Usage:
 *   <AppShell>
 *     <StatusBar ... />
 *     <main>...</main>
 *   </AppShell>
 */
import PropTypes from 'prop-types';

export default function AppShell({ children }) {
  return (
    <div
      className="h-screen flex flex-col overflow-hidden"
      style={{ background: '#0A0F1E' }}
    >
      {children}
    </div>
  );
}
AppShell.propTypes = { children: PropTypes.node };
