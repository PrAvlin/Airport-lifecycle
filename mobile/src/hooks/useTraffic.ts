import { useEffect, useState } from 'react';
import { fetchLocalities, fetchTraffic } from '../api/client';
import { Locality, TrafficEstimate } from '../types';

const REFRESH_MS = 3 * 60_000;

export function useTraffic() {
  const [localities, setLocalities] = useState<Locality[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [estimate, setEstimate] = useState<TrafficEstimate | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchLocalities()
      .then((list) => {
        setLocalities(list);
        if (list.length > 0) setSelectedId(list[0].id);
      })
      .catch(() => setLocalities([]));
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    let cancelled = false;

    function load() {
      setLoading(true);
      fetchTraffic(selectedId as string)
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
  }, [selectedId]);

  return { localities, selectedId, setSelectedId, estimate, loading };
}
