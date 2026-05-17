import { useState, useEffect, useRef } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const OLLAMA_POLL = 60000;

export default function useInsights(provider = 'ollama', refreshTrigger = 0) {
  const [insight, setInsight]               = useState('');
  const [blastRadius, setBlastRadius]       = useState('');
  const [action, setAction]                 = useState('');
  const [anomalies, setAnomalies]           = useState([]);
  const [activeProvider, setActiveProvider] = useState(provider);
  const [loading, setLoading]               = useState(true);
  const [lastFetchTime, setLastFetchTime]   = useState(null);
  const [loadingSeconds, setLoadingSeconds] = useState(0);

  const lastInsight   = useRef('');
  const loadStartRef  = useRef(null);
  const tickRef       = useRef(null);

  // Tick the loading counter while loading
  useEffect(() => {
    if (loading) {
      if (!loadStartRef.current) loadStartRef.current = Date.now();
      tickRef.current = setInterval(() => {
        setLoadingSeconds(Math.round((Date.now() - loadStartRef.current) / 1000));
      }, 1000);
    } else {
      clearInterval(tickRef.current);
      loadStartRef.current = null;
      setLoadingSeconds(0);
    }
    return () => clearInterval(tickRef.current);
  }, [loading]);

  useEffect(() => {
    let cancelled = false;

    setInsight('');
    setBlastRadius('');
    setAction('');
    setLoading(true);
    loadStartRef.current = null;
    lastInsight.current = '';

    async function fetchInsights(isFirst = false) {
      if (isFirst) setLoading(true);
      try {
        const res = await fetch(`${API_URL}/insights?provider=${provider}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!cancelled) {
          setInsight(data.insight || '');
          setBlastRadius(data.blast_radius || '');
          setAction(data.action || data.kubectl_command || '');
          setAnomalies(data.anomalies || []);
          setActiveProvider(data.provider || provider);
          setLastFetchTime(Date.now());
          lastInsight.current = data.insight || '';
        }
      } catch (err) {
        console.error('useInsights fetch failed:', err);
        if (!cancelled && lastInsight.current) setInsight(lastInsight.current);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchInsights(true);

    let id = null;
    if (provider !== 'openai') {
      id = setInterval(() => fetchInsights(false), OLLAMA_POLL);
    }

    return () => {
      cancelled = true;
      if (id) clearInterval(id);
    };
  }, [provider, refreshTrigger]);

  return { insight, blastRadius, action, anomalies, provider: activeProvider, loading, lastFetchTime, loadingSeconds };
}
