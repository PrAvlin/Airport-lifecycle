import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { API_BASE_URL, fetchFlight } from '../api/client';
import { FlightState, FlightUpdateEvent } from '../types';
import { notifyFlightUpdate } from '../services/notifications';

interface UseFlightStatusResult {
  flight: FlightState | null;
  loading: boolean;
  error: string | null;
  lastEvent: FlightUpdateEvent | null;
}

export function useFlightStatus(flightNumber: string | null, airport: string): UseFlightStatusResult {
  const [flight, setFlight] = useState<FlightState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastEvent, setLastEvent] = useState<FlightUpdateEvent | null>(null);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!flightNumber) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchFlight(flightNumber, airport)
      .then((data) => {
        if (!cancelled) setFlight(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message ?? 'Failed to load flight');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    const socket = io(API_BASE_URL, { transports: ['websocket'] });
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('subscribe', flightNumber);
    });

    socket.on('flight:snapshot', (payload: { flight: FlightState }) => {
      if (!cancelled) setFlight(payload.flight);
    });

    socket.on('flight:update', (event: FlightUpdateEvent) => {
      if (cancelled) return;
      setFlight(event.flight);
      setLastEvent(event);
      notifyFlightUpdate(event);
    });

    return () => {
      cancelled = true;
      socket.emit('unsubscribe', flightNumber);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [flightNumber, airport]);

  return { flight, loading, error, lastEvent };
}
