/**
 * api.js — Centralised API client for the dashboard.
 *
 * Moved from: frontend/src/services/api.js
 * Updated: base URL now reads VITE_API_URL (not a hardcoded 127.0.0.1),
 *          endpoints corrected to match the actual API routes (/pods, /insights, etc.)
 *
 * Why this exists alongside the fetch-based hooks:
 *   The hooks (usePods, useInsights, useGraph) use raw fetch because they need
 *   fine-grained lifecycle control (cancellation, polling intervals).
 *   This api.js client is available for one-shot imperative calls (e.g. from
 *   a button handler) and for integration tests that need axios interceptors.
 *
 * All methods return data or throw normalised Error objects — never raw axios errors.
 */
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const apiClient = axios.create({
  baseURL: API_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
});

// Retry interceptor — retries once on 5xx or network timeout for idempotent GETs
apiClient.interceptors.response.use(
  response => response,
  async error => {
    const config = error.config;
    if (!config || !config.retry) return Promise.reject(error);
    config.retryCount = config.retryCount || 0;
    if (config.retryCount >= config.retry) return Promise.reject(error);
    config.retryCount += 1;
    await new Promise(r => setTimeout(r, 1000 * Math.pow(2, config.retryCount)));
    return apiClient(config);
  }
);

const normalizeError = (error, defaultMessage) => {
  if (error.response) {
    return new Error(error.response.data?.detail || `API ${error.response.status}: ${defaultMessage}`);
  }
  if (error.request) return new Error(`Network unreachable: ${defaultMessage}`);
  return new Error(error.message || defaultMessage);
};

export const getHealth = async () => {
  try {
    const r = await apiClient.get('/health', { retry: 2 });
    return r.data;
  } catch (e) { throw normalizeError(e, 'Health check failed'); }
};

export const getPods = async () => {
  try {
    const r = await apiClient.get('/pods', { retry: 2 });
    return r.data;
  } catch (e) { throw normalizeError(e, 'Failed to fetch pods'); }
};

export const getAnomalies = async () => {
  try {
    const r = await apiClient.get('/anomalies', { retry: 2 });
    return r.data;
  } catch (e) { throw normalizeError(e, 'Failed to fetch anomalies'); }
};

export const getGraph = async () => {
  try {
    const r = await apiClient.get('/graph', { retry: 2 });
    return r.data;
  } catch (e) { throw normalizeError(e, 'Failed to fetch dependency graph'); }
};

export const getInsights = async (provider = 'ollama') => {
  try {
    // LLM inference can be slow — use a longer timeout than other endpoints
    const r = await apiClient.get(`/insights?provider=${provider}`, { timeout: 95000 });
    return r.data;
  } catch (e) { throw normalizeError(e, 'AI inference timed out or failed'); }
};

export const getConfig = async () => {
  try {
    const r = await apiClient.get('/config');
    return r.data;
  } catch (e) { throw normalizeError(e, 'Failed to fetch config'); }
};
