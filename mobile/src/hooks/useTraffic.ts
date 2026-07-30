import { useEffect, useState } from 'react';
import { fetchLocalities, fetchTraffic } from '../api/client';
import { Locality, TrafficEstimate } from '../types';

const REFRESH_MS = 3 * 60_000;

export function useTraffic(airport: string) {
  const [localities, setLocalities] = useState<Locality[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [estimate, setEstimate] = useState<TrafficEstimate | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchLocalities(airport)
      .then((list) => {
        setLocalities(list);
        if (list.length > 0) setSelectedId(list[0].id);
      })
      .catch(() => setLocalities([]));
  }, [airport]);

  useEffect(() => {
    if (!selectedId) return;
    let cancelled = false;

    function load() {
      setLoading(true);
      fetchTraffic(airport, selectedId as string)
        .then((data) => {
          if (!cancelled) setEstimate(data);
        })
        .catch(() => {
          if (!cancelled) setEstimate(null);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }

    load();
    const interval = setInterval(load, REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [selectedId, airport]);

  return { localities, selectedId, setSelectedId, estimate, loading };
}
