/**
 * main.jsx — Vite entry point. Mounts React into #root.
 *
 * Moved from: frontend/src/main.jsx
 * New location: apps/dashboard/src/main.jsx
 *
 * Import order: React core → App → global CSS.
 * CSS must come after App so Tailwind base styles don't override component styles.
 */
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './styles/index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
