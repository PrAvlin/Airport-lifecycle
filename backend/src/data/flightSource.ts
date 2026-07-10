import { config } from '../config';
import { ArrivalFlightState, BoardingMethod, DataSource, FlightState, FlightUpdateEvent, FlightUpdateEventType } from '../types';
import { seedDemoFlights, seedDemoArrivals } from './flights';
import { isKnownOrigin, getOriginAirport } from './airports';
import { fetchLiveFlights } from '../services/aerodatabox';
import { ReportPhase, submitReport } from '../services/boardingReports';
import { recomputeEstimate } from '../services/methodEstimate';

type EventEmitter = (event: FlightUpdateEvent) => void;

// Keyed by `${originIata}:${flightNumber}` — the same flight number can exist
// out of two different airports on the same day.
const store = new Map<string, FlightState>();
// Keyed by `${destinationIata}:${flightNumber}` - arrivals INTO an airport,
// the mirror of the departures store above.
const arrivalStore = new Map<string, ArrivalFlightState>();
let currentDataSource: DataSource = config.aerodatabox.enabled ? 'live' : 'demo';
let lastError: string | null = null;
let lastFetchedAt: string | null = null;
let broadcastEmitter: EventEmitter | null = null;

// AeroDataBox's free tier is ~100 requests/month total, which can't support
// polling a large list of airports on a timer - so instead of fetching every
// supported airport whether anyone's looking or not, each airport is only
// fetched when someone actually opens it (below), cached for this long.
const FETCH_CACHE_TTL_MS = 10 * 60_000;
const lastFetchedByAirport = new Map<string, number>();

function storeKey(airport: string, flightNumber: string): string {
  return `${airport.toUpperCase()}:${flightNumber.toUpperCase()}`;
}

/** Set once at server startup so parts of the app outside the poll loop (e.g. the reports route) can emit socket events too. */
export function setBroadcastEmitter(emit: EventEmitter): void {
  broadcastEmitter = emit;
}

/** Airports that have been fetched at least once recently - used by the background refresher so it only ever touches airports someone's actually viewing. */
export function getActiveAirports(): string[] {
  return Array.from(lastFetchedByAirport.keys());
}

/**
 * Fetches this one airport's live departures AND arrivals (one AeroDataBox
 * call covers both - see fetchLiveFlights) if the cached data is stale (or
 * missing), otherwise does nothing. Called from the routes so opening an
 * airport in the app is what triggers freshness, not a fixed background
 * schedule - the only way to support many airports within the free quota.
 */
export async function ensureFreshFlights(originIata: string, emit?: EventEmitter): Promise<void> {
  if (!config.aerodatabox.enabled || !isKnownOrigin(originIata)) return;
  const origin = originIata.toUpperCase();
  const lastFetch = lastFetchedByAirport.get(origin) ?? 0;
  if (Date.now() - lastFetch < FETCH_CACHE_TTL_MS) return;

  // Set before awaiting so concurrent requests for the same airport don't pile up refetches.
  lastFetchedByAirport.set(origin, Date.now());
  try {
    const { departures, arrivals } = await fetchLiveFlights(getOriginAirport(origin));
    applyLiveSnapshot(origin, departures, emit ?? broadcastEmitter ?? undefined);
    applyLiveArrivalSnapshot(origin, arrivals);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown AeroDataBox error';
    recordFetchError(message);
    console.error(`[flights] ${origin} fetch failed: ${message}`);
  }
}

export function getSourceMeta() {
  return { dataSource: currentDataSource, lastError, lastFetchedAt };
}

/** Upcoming flights first (soonest departure/arrival first), already-happened ones after (most recent first). */
function byNextTime(aTimeIso: string, bTimeIso: string): number {
  const now = Date.now();
  const aTime = new Date(aTimeIso).getTime();
  const bTime = new Date(bTimeIso).getTime();
  const aUpcoming = aTime >= now;
  const bUpcoming = bTime >= now;
  if (aUpcoming !== bUpcoming) return aUpcoming ? -1 : 1;
  return aUpcoming ? aTime - bTime : bTime - aTime;
}

export function listFlights(originIata?: string): FlightState[] {
  const all = Array.from(store.values());
  const filtered = originIata ? all.filter((f) => f.origin === originIata.toUpperCase()) : all;
  return filtered.sort((a, b) => byNextTime(a.estimatedDeparture, b.estimatedDeparture));
}

export function getFlightByNumber(flightNumber: string, originIata?: string): FlightState | undefined {
  if (originIata) return store.get(storeKey(originIata, flightNumber));
  // No airport given (e.g. a socket subscribe by flight number alone): first match wins.
  const upper = flightNumber.toUpperCase();
  return Array.from(store.values()).find((f) => f.flightNumber === upper);
}

export function listArrivals(destinationIata?: string): ArrivalFlightState[] {
  const all = Array.from(arrivalStore.values());
  const filtered = destinationIata ? all.filter((f) => f.destination === destinationIata.toUpperCase()) : all;
  return filtered.sort((a, b) => byNextTime(a.estimatedArrival, b.estimatedArrival));
}

export function getArrivalByNumber(flightNumber: string, destinationIata?: string): ArrivalFlightState | undefined {
  if (destinationIata) return arrivalStore.get(storeKey(destinationIata, flightNumber));
  const upper = flightNumber.toUpperCase();
  return Array.from(arrivalStore.values()).find((f) => f.flightNumber === upper);
}

export function seedDemoMode(): void {
  currentDataSource = 'demo';
  store.clear();
  arrivalStore.clear();
  for (const flight of seedDemoFlights()) {
    store.set(storeKey(flight.origin, flight.flightNumber), flight);
  }
  for (const arrival of seedDemoArrivals()) {
    arrivalStore.set(storeKey(arrival.destination, arrival.flightNumber), arrival);
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

/** Mirror of patchDemoFlight for the arrivals store. */
export function patchDemoArrival(
  destination: string,
  flightNumber: string,
  patch: Partial<ArrivalFlightState>,
): ArrivalFlightState | undefined {
  const key = storeKey(destination, flightNumber);
  const existing = arrivalStore.get(key);
  if (!existing) return undefined;
  const updated: ArrivalFlightState = { ...existing, ...patch, lastUpdated: new Date().toISOString() };
  arrivalStore.set(key, updated);
  return updated;
}

function makeEvent(type: FlightUpdateEventType, flight: FlightState, message: string): FlightUpdateEvent {
  return { type, flightId: flight.id, flight, message, timestamp: new Date().toISOString() };
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' });
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

/** Mirror of applyLiveSnapshot for arrivals INTO one airport. */
export function applyLiveArrivalSnapshot(destinationIata: string, arrivals: ArrivalFlightState[]): void {
  const destination = destinationIata.toUpperCase();

  for (const nextArrival of arrivals) {
    arrivalStore.set(storeKey(destination, nextArrival.flightNumber), nextArrival);
  }

  const freshKeys = new Set(arrivals.map((f) => storeKey(destination, f.flightNumber)));
  for (const key of Array.from(arrivalStore.keys())) {
    if (key.startsWith(`${destination}:`) && !freshKeys.has(key)) arrivalStore.delete(key);
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

  const relevantAirport = phase === 'board' ? flight.origin : flight.destination;
  submitReport(flight.id, phase, method, relevantAirport);
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

/**
 * Same idea as reportBoardingMethod, but for a flight found via the arrivals
 * list rather than the departures list - reports feed the same per-airport
 * consensus pool either way (see methodEstimate.ts's consensusInputs), since
 * both are ultimately reports about deplaning at the same airport.
 */
export function reportArrivalMethod(
  flightNumber: string,
  method: BoardingMethod,
  destinationIata?: string,
): ArrivalFlightState | undefined {
  const arrival = getArrivalByNumber(flightNumber, destinationIata);
  if (!arrival) return undefined;

  submitReport(arrival.id, 'deplane', method, arrival.destination);
  const nextEstimate = recomputeEstimate(arrival.id, 'deplane');
  if (!nextEstimate) return arrival;

  const updated: ArrivalFlightState = { ...arrival, disembark: nextEstimate, lastUpdated: new Date().toISOString() };
  arrivalStore.set(storeKey(arrival.destination, arrival.flightNumber), updated);
  return updated;
}
