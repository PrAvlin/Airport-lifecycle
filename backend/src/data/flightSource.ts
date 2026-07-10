import { config } from '../config';
import { DataSource, FlightState, FlightUpdateEvent, FlightUpdateEventType } from '../types';
import { seedDemoFlights } from './flights';
import { applyReportOverlay, ReportPhase, submitReport } from '../services/boardingReports';

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
    store.set(flight.flightNumber, applyReportOverlay(flight));
  }
}

export function patchDemoFlight(flightNumber: string, patch: Partial<FlightState>): FlightState | undefined {
  const key = flightNumber.toUpperCase();
  const existing = store.get(key);
  if (!existing) return undefined;
  const updated = applyReportOverlay({ ...existing, ...patch, lastUpdated: new Date().toISOString() });
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
 * notifications used in demo mode fire for real changes too. Any locked
 * crowd-sourced confirmations are re-applied on top, since a fresh API poll
 * would otherwise overwrite them with the plain heuristic guess again.
 */
export function applyLiveSnapshot(flights: FlightState[], emit?: EventEmitter): void {
  currentDataSource = 'live';
  lastError = null;
  lastFetchedAt = new Date().toISOString();

  for (const fetched of flights) {
    const nextFlight = applyReportOverlay(fetched);
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

/** Submits a passenger's report of what they actually saw; applies + broadcasts immediately once consensus locks it in. */
export function reportBoardingMethod(
  flightNumber: string,
  phase: ReportPhase,
  method: FlightState['boardingMethod'],
): { flight: FlightState; locked: boolean } | undefined {
  const flight = getFlightByNumber(flightNumber);
  if (!flight) return undefined;

  const result = submitReport(flight.id, phase, method);
  if (!result.locked) {
    return { flight, locked: false };
  }

  const updated = applyReportOverlay(flight);
  store.set(flight.flightNumber, updated);

  if (broadcastEmitter) {
    const label = phase === 'board' ? 'Boarding' : 'Deplaning';
    const methodLabel = result.method!.replace(/_/g, ' ');
    broadcastEmitter(
      makeEvent('boarding_method_change', updated, `${label} method for ${flightNumber} confirmed by fellow passengers: ${methodLabel}`),
    );
  }

  return { flight: updated, locked: true };
}
