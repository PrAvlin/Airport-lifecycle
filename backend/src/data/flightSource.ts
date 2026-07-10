import { config } from '../config';
import { DataSource, FlightState, FlightUpdateEvent, FlightUpdateEventType } from '../types';
import { seedDemoFlights } from './flights';
import { ReportPhase, submitReport } from '../services/boardingReports';
import { recomputeEstimate } from '../services/methodEstimate';

type EventEmitter = (event: FlightUpdateEvent) => void;

// Keyed by `${originIata}:${flightNumber}` — the same flight number can exist
// out of two different airports on the same day.
const store = new Map<string, FlightState>();
let currentDataSource: DataSource = config.aerodatabox.enabled ? 'live' : 'demo';
let lastError: string | null = null;
let lastFetchedAt: string | null = null;
let broadcastEmitter: EventEmitter | null = null;

function storeKey(origin: string, flightNumber: string): string {
  return `${origin.toUpperCase()}:${flightNumber.toUpperCase()}`;
}

/** Set once at server startup so parts of the app outside the poll loop (e.g. the reports route) can emit socket events too. */
export function setBroadcastEmitter(emit: EventEmitter): void {
  broadcastEmitter = emit;
}

export function getSourceMeta() {
  return { dataSource: currentDataSource, lastError, lastFetchedAt };
}

export function listFlights(originIata?: string): FlightState[] {
  const all = Array.from(store.values());
  if (!originIata) return all;
  const origin = originIata.toUpperCase();
  return all.filter((f) => f.origin === origin);
}

export function getFlightByNumber(flightNumber: string, originIata?: string): FlightState | undefined {
  if (originIata) return store.get(storeKey(originIata, flightNumber));
  // No airport given (e.g. a socket subscribe by flight number alone): first match wins.
  const upper = flightNumber.toUpperCase();
  return Array.from(store.values()).find((f) => f.flightNumber === upper);
}

export function seedDemoMode(): void {
  currentDataSource = 'demo';
  store.clear();
  for (const flight of seedDemoFlights()) {
    store.set(storeKey(flight.origin, flight.flightNumber), flight);
  }
}

export function patchDemoFlight(origin: string, flightNumber: string, patch: Partial<FlightState>): FlightState | undefined {
  const key = storeKey(origin, flightNumber);
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
 * Merges a freshly-fetched live snapshot for ONE origin airport into the
 * store, diffing against the previous state per flight so gate/confidence/
 * status/delay notifications fire for real changes. Flights of other origin
 * airports are left untouched.
 */
export function applyLiveSnapshot(originIata: string, flights: FlightState[], emit?: EventEmitter): void {
  currentDataSource = 'live';
  lastError = null;
  lastFetchedAt = new Date().toISOString();
  const origin = originIata.toUpperCase();

  for (const nextFlight of flights) {
    const key = storeKey(origin, nextFlight.flightNumber);
    const previous = store.get(key);
    store.set(key, nextFlight);

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

  const freshKeys = new Set(flights.map((f) => storeKey(origin, f.flightNumber)));
  for (const key of Array.from(store.keys())) {
    if (key.startsWith(`${origin}:`) && !freshKeys.has(key)) store.delete(key);
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
  originIata?: string,
): FlightState | undefined {
  const flight = getFlightByNumber(flightNumber, originIata);
  if (!flight) return undefined;

  submitReport(flight.id, phase, method);
  const nextEstimate = recomputeEstimate(flight.id, phase);
  if (!nextEstimate) return flight;

  const previousEstimate = phase === 'board' ? flight.boarding : flight.arrival.disembark;
  const updated: FlightState =
    phase === 'board'
      ? { ...flight, boarding: nextEstimate, lastUpdated: new Date().toISOString() }
      : { ...flight, arrival: { ...flight.arrival, disembark: nextEstimate }, lastUpdated: new Date().toISOString() };

  store.set(storeKey(flight.origin, flight.flightNumber), updated);

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
