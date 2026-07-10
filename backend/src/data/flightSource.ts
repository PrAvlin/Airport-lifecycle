import { config } from '../config';
import { DataSource, FlightState, FlightUpdateEvent, FlightUpdateEventType } from '../types';
import { seedDemoFlights } from './flights';

type EventEmitter = (event: FlightUpdateEvent) => void;

const store = new Map<string, FlightState>();
let currentDataSource: DataSource = config.aerodatabox.enabled ? 'live' : 'demo';
let lastError: string | null = null;
let lastFetchedAt: string | null = null;

export function getDataSource(): DataSource {
  return currentDataSource;
}

export function getSourceMeta() {
  return { dataSource: currentDataSource, lastError, lastFetchedAt };
}

export function listFlights(): FlightState[] {
  return Array.from(store.values());
}

export function getFlightByNumber(flightNumber: string): FlightState | undefined {
  return store.get(flightNumber.toUpperCase());
}

export function seedDemoMode(): void {
  currentDataSource = 'demo';
  store.clear();
  for (const flight of seedDemoFlights(8)) {
    store.set(flight.flightNumber, flight);
  }
}

export function patchDemoFlight(flightNumber: string, patch: Partial<FlightState>): FlightState | undefined {
  const key = flightNumber.toUpperCase();
  const existing = store.get(key);
  if (!existing) return undefined;
  const updated: FlightState = { ...existing, ...patch, lastUpdated: new Date().toISOString() };
  store.set(key, updated);
  return updated;
}

function makeEvent(type: FlightUpdateEventType, flight: FlightState, message: string): FlightUpdateEvent {
  return { type, flightId: flight.id, flight, message, timestamp: new Date().toISOString() };
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

/**
 * Merges a freshly-fetched live snapshot into the store, diffing against the
 * previous state per flight so the same gate/boarding-method/status/delay
 * notifications used in demo mode fire for real changes too.
 */
export function applyLiveSnapshot(flights: FlightState[], emit?: EventEmitter): void {
  currentDataSource = 'live';
  lastError = null;
  lastFetchedAt = new Date().toISOString();

  for (const nextFlight of flights) {
    const previous = store.get(nextFlight.flightNumber);
    store.set(nextFlight.flightNumber, nextFlight);

    if (!previous || !emit) continue;

    if (previous.gate !== nextFlight.gate) {
      emit(makeEvent('gate_change', nextFlight, `Gate changed to ${nextFlight.gate} for ${nextFlight.flightNumber}`));
    }
    if (previous.boardingMethod !== nextFlight.boardingMethod) {
      emit(makeEvent('boarding_method_change', nextFlight, `${nextFlight.flightNumber} boarding method updated`));
    }
    if (previous.estimatedDeparture !== nextFlight.estimatedDeparture) {
      emit(
        makeEvent(
          'delay',
          nextFlight,
          `${nextFlight.flightNumber} now estimated to depart ${formatTime(nextFlight.estimatedDeparture)}`,
        ),
      );
    }
    if (previous.status !== nextFlight.status) {
      emit(makeEvent('status_change', nextFlight, `${nextFlight.flightNumber} status: ${nextFlight.status}`));
    }
  }

  const freshNumbers = new Set(flights.map((f) => f.flightNumber));
  for (const key of Array.from(store.keys())) {
    if (!freshNumbers.has(key)) store.delete(key);
  }
}

export function recordFetchError(message: string): void {
  lastError = message;
}
