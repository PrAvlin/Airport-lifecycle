import { config } from '../config';
import { DataSource, FlightState, FlightUpdateEvent, FlightUpdateEventType } from '../types';
import { seedDemoFlights } from './flights';
import { ReportPhase, submitReport } from '../services/boardingReports';
import { recomputeEstimate } from '../services/methodEstimate';

type EventEmitter = (event: FlightUpdateEvent) => void;

const store = new Map<string, FlightState>();
let currentDataSource: DataSource = config.aerodatabox.enabled ? 'live' : 'demo';
let lastError: string | null = null;
let lastFetchedAt: string | null = null;
let broadcastEmitter: EventEmitter | null = null;

/** Set once at server startup so parts of the app outside the poll loop (e.g. the reports route) can emit socket events too. */
export function setBroadcastEmitter(emit: EventEmitter): void {
  broadcastEmitter = emit;
}

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
 * previous state per flight so the same gate/boarding-confidence/status/
 * delay notifications used in demo mode fire for real changes too. Each
 * fetched flight already carries a freshly-computed boarding/disembark
 * estimate (built from current crowd report tallies), so no separate
 * overlay step is needed here.
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
    if (previous.boarding.confidenceLevel !== nextFlight.boarding.confidenceLevel) {
      emit(makeEvent('boarding_method_change', nextFlight, `${nextFlight.flightNumber} boarding confidence updated`));
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

/**
 * Submits a passenger's report of what they actually saw boarding or
 * deplaning, recomputes that flight's estimate immediately (rather than
 * waiting for the next poll), and broadcasts if the confidence level
 * actually changed as a result.
 */
export function reportBoardingMethod(
  flightNumber: string,
  phase: ReportPhase,
  method: Parameters<typeof submitReport>[2],
): FlightState | undefined {
  const flight = getFlightByNumber(flightNumber);
  if (!flight) return undefined;

  submitReport(flight.id, phase, method);
  const nextEstimate = recomputeEstimate(flight.id, phase);
  if (!nextEstimate) return flight;

  const previousEstimate = phase === 'board' ? flight.boarding : flight.arrival.disembark;
  const updated: FlightState =
    phase === 'board'
      ? { ...flight, boarding: nextEstimate, lastUpdated: new Date().toISOString() }
      : { ...flight, arrival: { ...flight.arrival, disembark: nextEstimate }, lastUpdated: new Date().toISOString() };

  store.set(flight.flightNumber, updated);

  if (broadcastEmitter && previousEstimate.confidenceLevel !== nextEstimate.confidenceLevel) {
    const label = phase === 'board' ? 'Boarding' : 'Deplaning';
    const methodLabel = nextEstimate.method.replace(/_/g, ' ');
    const message =
      nextEstimate.confidenceLevel === 'confirmed'
        ? `${label} method for ${flightNumber} confirmed by fellow passengers: ${methodLabel}`
        : `${label} method for ${flightNumber} now looks likely: ${methodLabel}`;
    broadcastEmitter(makeEvent('boarding_method_change', updated, message));
  }

  return updated;
}
