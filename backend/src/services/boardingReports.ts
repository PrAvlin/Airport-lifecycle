import { BoardingMethod } from '../types';

export type ReportPhase = 'board' | 'deplane';

/**
 * Raw crowd-report tallies: passengers reporting what they actually saw at
 * the gate or aircraft door. Keyed by flight id (which embeds the scheduled
 * time, so it's specific to one departure, not the flight number in
 * general) + phase. This module only stores counts - turning that into a
 * confidence level and a display method is methodEstimate.ts's job.
 */
const reports = new Map<string, Partial<Record<BoardingMethod, number>>>();

function key(flightId: string, phase: ReportPhase): string {
  return `${flightId}:${phase}`;
}

export function submitReport(
  flightId: string,
  phase: ReportPhase,
  method: BoardingMethod,
): Partial<Record<BoardingMethod, number>> {
  const k = key(flightId, phase);
  const counts = { ...(reports.get(k) ?? {}) };
  counts[method] = (counts[method] ?? 0) + 1;
  reports.set(k, counts);
  return counts;
}

export function getReportCounts(flightId: string, phase: ReportPhase): Partial<Record<BoardingMethod, number>> {
  return reports.get(key(flightId, phase)) ?? {};
}
