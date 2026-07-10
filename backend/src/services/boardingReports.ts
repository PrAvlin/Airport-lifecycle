import { BoardingMethod } from '../types';

export type ReportPhase = 'board' | 'deplane';

/**
 * Raw crowd-report tallies, tracked at two levels:
 * - Per exact flight (this flight's own scheduled departure) - the strict
 *   "3 matching reports locks it as confirmed" signal.
 * - Per airport, accumulated across every flight/day - a weaker but
 *   longer-lived signal ("out of the last N reports for this airport, most
 *   said shuttle") that kicks in for airports with no curated gate/terminal
 *   data, instead of falling back to a blind coin-flip.
 * Turning either into a confidence level and a display method is
 * methodEstimate.ts's job.
 */
const flightReports = new Map<string, Partial<Record<BoardingMethod, number>>>();
const airportReports = new Map<string, Partial<Record<BoardingMethod, number>>>();

function flightKey(flightId: string, phase: ReportPhase): string {
  return `${flightId}:${phase}`;
}

function airportKey(airportIata: string, phase: ReportPhase): string {
  return `${airportIata.toUpperCase()}:${phase}`;
}

export function submitReport(
  flightId: string,
  phase: ReportPhase,
  method: BoardingMethod,
  airportIata: string,
): Partial<Record<BoardingMethod, number>> {
  const fKey = flightKey(flightId, phase);
  const flightCounts = { ...(flightReports.get(fKey) ?? {}) };
  flightCounts[method] = (flightCounts[method] ?? 0) + 1;
  flightReports.set(fKey, flightCounts);

  const aKey = airportKey(airportIata, phase);
  const airportCounts = { ...(airportReports.get(aKey) ?? {}) };
  airportCounts[method] = (airportCounts[method] ?? 0) + 1;
  airportReports.set(aKey, airportCounts);

  return flightCounts;
}

export function getReportCounts(flightId: string, phase: ReportPhase): Partial<Record<BoardingMethod, number>> {
  return flightReports.get(flightKey(flightId, phase)) ?? {};
}

export function getAirportReportCounts(airportIata: string, phase: ReportPhase): Partial<Record<BoardingMethod, number>> {
  return airportReports.get(airportKey(airportIata, phase)) ?? {};
}
