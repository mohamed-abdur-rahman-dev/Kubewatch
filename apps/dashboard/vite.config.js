/**
 * vite.config.js — Vite build configuration for the dashboard.
 *
 * Moved from: frontend/vite.config.js
 * No changes needed — all paths are relative to this file's location.
 */
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    host: true, // bind 0.0.0.0 so Docker/WSL can reach it
  },
});
