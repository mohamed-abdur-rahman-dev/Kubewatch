/**
 * useConfig.js — Fetches provider availability from GET /config on mount.
 *
 * Moved from: frontend/src/hooks/useConfig.js
 * New location: apps/dashboard/src/hooks/useConfig.js
 *
 * No logic changes. Returns safe defaults if the request fails —
 * the app works without the config endpoint (just no cloud AI toggle).
 */
import { useState, useEffect } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export default function useConfig() {
  const [config, setConfig] = useState({
    openai_available: false,
    ollama_available: true,
    default_provider: 'ollama',
  });

  useEffect(() => {
    fetch(`${API_URL}/config`)
      .then(r => r.json())
      .then(setConfig)
      .catch(() => {}); // keep safe defaults on network error
  }, []);

  return config;
}
