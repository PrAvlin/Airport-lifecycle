import { BoardingMethod, FlightState } from '../types';

export type ReportPhase = 'board' | 'deplane';

interface ReportTally {
  counts: Partial<Record<BoardingMethod, number>>;
  lockedMethod?: BoardingMethod;
}

/**
 * Crowdsourced confirmation: passengers report what they actually saw at the
 * gate/aircraft door. Once enough independent reports agree on the same
 * method for a specific flight instance, it's locked in as confirmed data
 * instead of our terminal/heuristic estimate. Keyed by flight id (which
 * embeds the scheduled time) + phase, so it's specific to one departure, not
 * the flight number in general (the same flight number flies a different
 * gate/stand every day).
 */
const LOCK_THRESHOLD = 3;
const reports = new Map<string, ReportTally>();

function key(flightId: string, phase: ReportPhase): string {
  return `${flightId}:${phase}`;
}

export function submitReport(
  flightId: string,
  phase: ReportPhase,
  method: BoardingMethod,
): { locked: boolean; method?: BoardingMethod; count: number } {
  const k = key(flightId, phase);
  let tally = reports.get(k);
  if (!tally) {
    tally = { counts: {} };
    reports.set(k, tally);
  }

  if (tally.lockedMethod) {
    return { locked: true, method: tally.lockedMethod, count: tally.counts[tally.lockedMethod] ?? LOCK_THRESHOLD };
  }

  tally.counts[method] = (tally.counts[method] ?? 0) + 1;
  const count = tally.counts[method]!;

  if (count >= LOCK_THRESHOLD) {
    tally.lockedMethod = method;
    return { locked: true, method, count };
  }
  return { locked: false, count };
}

export function getConfirmedMethod(flightId: string, phase: ReportPhase): BoardingMethod | undefined {
  return reports.get(key(flightId, phase))?.lockedMethod;
}

/** Overlays any locked crowd confirmations onto a freshly-fetched/estimated flight object. */
export function applyReportOverlay(flight: FlightState): FlightState {
  let next = flight;

  const board = getConfirmedMethod(flight.id, 'board');
  if (board) {
    next = { ...next, boardingMethod: board, boardingMethodConfidence: 'confirmed' };
  }

  const deplane = getConfirmedMethod(flight.id, 'deplane');
  if (deplane) {
    next = { ...next, arrival: { ...next.arrival, disembarkMethod: deplane, disembarkMethodConfidence: 'confirmed' } };
  }

  return next;
}
