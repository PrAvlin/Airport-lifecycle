import { useEffect, useState } from 'react';
import { fetchArrival } from '../api/client';
import { ArrivalFlightState } from '../types';

interface UseArrivalStatusResult {
  arrival: ArrivalFlightState | null;
  loading: boolean;
  error: string | null;
}

// Arrivals have no socket push (see flightSource.ts's applyLiveArrivalSnapshot),
// so this screen polls instead of relying on a live event - otherwise gate,
// status, and disembark-method changes would never show up while it's open.
const REFRESH_MS = 30_000;

export function useArrivalStatus(flightNumber: string | null, airport: string): UseArrivalStatusResult {
  const [arrival, setArrival] = useState<ArrivalFlightState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!flightNumber) return;
    let cancelled = false;

    function load(isFirst: boolean) {
      if (isFirst) setLoading(true);
      fetchArrival(flightNumber as string, airport)
        .then((data) => {
          if (!cancelled) {
            setArrival(data);
            setError(null);
          }
        })
        .catch((err) => {
          if (!cancelled && isFirst) setError(err.message ?? 'Failed to load arrival');
        })
        .finally(() => {
          if (!cancelled && isFirst) setLoading(false);
        });
    }

    load(true);
    const interval = setInterval(() => load(false), REFRESH_MS);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [flightNumber, airport]);

  return { arrival, loading, error };
}
