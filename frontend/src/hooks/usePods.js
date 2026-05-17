import { useState, useEffect, useRef } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const POLL_INTERVAL = 15000;

export default function usePods(refreshTrigger = 0) {
  const [pods, setPods] = useState([]);
  const [snapshot, setSnapshot] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const lastData = useRef({ pods: [], snapshot: null });

  useEffect(() => {
    let cancelled = false;

    async function fetchPods() {
      try {
        const res = await fetch(`${API_URL}/pods`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!cancelled) {
          setPods(data.pods);
          setSnapshot(data.snapshot);
          lastData.current = { pods: data.pods, snapshot: data.snapshot };
          setError(null);
        }
      } catch (err) {
        console.error('usePods fetch failed:', err);
        if (!cancelled) {
          // Keep last known data — do not blank the screen
          setPods(lastData.current.pods);
          setSnapshot(lastData.current.snapshot);
          setError(err.message);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchPods();
    const id = setInterval(fetchPods, POLL_INTERVAL);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [refreshTrigger]);

  return { pods, snapshot, loading, error };
}
