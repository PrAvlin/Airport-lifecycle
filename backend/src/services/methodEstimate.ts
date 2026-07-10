import { BlrTerminal, TERMINAL_PROFILE } from '../data/airport';
import { getDestinationProfile } from '../data/destinationAirports';
import { getReportCounts, ReportPhase } from './boardingReports';
import { BoardingMethod, MethodConfidenceLevel, MethodEstimate } from '../types';

const LOCK_THRESHOLD = 3;
const LIKELY_THRESHOLD = 0.75;

function hashString(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  }
  return hash;
}

/** Deterministic (not random) tie-break between shuttle bus and a short walk, for the non-bridge case. */
function tieBreakNonBridge(seed: string): BoardingMethod {
  const roll = hashString(seed) % 100;
  return roll % 5 === 0 ? 'walk_to_aircraft' : 'shuttle_bus';
}

function methodLabel(method: BoardingMethod): string {
  switch (method) {
    case 'jet_bridge':
      return 'a jet bridge';
    case 'shuttle_bus':
      return 'a shuttle bus';
    case 'walk_to_aircraft':
      return 'walking to the aircraft';
  }
}

export function boardingBaseShareAndReason(terminal: string): { share: number; reason: string } {
  const profile = TERMINAL_PROFILE[terminal as BlrTerminal] ?? TERMINAL_PROFILE.T1;
  const reason =
    terminal === 'T2'
      ? 'T2 is a modern terminal where nearly all gates use aerobridges.'
      : 'T1 is an older terminal that mixes aerobridge gates with remote stands reached by bus.';
  return { share: profile.aerobridgeShare, reason };
}

export function disembarkBaseShareAndReason(destinationIata: string): { share: number; reason: string } {
  const profile = getDestinationProfile(destinationIata);
  const reason =
    profile.aerobridgeShare >= 0.85
      ? `${profile.name} is predominantly aerobridge-served.`
      : profile.aerobridgeShare <= 0.5
        ? `${profile.name} regularly uses remote stands reached by bus or a short walk.`
        : `${profile.name} uses a mix of aerobridge and remote stands.`;
  return { share: profile.aerobridgeShare, reason };
}

interface FlightMethodContext {
  baseShare: number;
  baseReason: string;
  isQuickTurn: boolean;
  seed: string;
}

/**
 * Registered whenever a flight is created/refreshed from the flight source
 * (live poll or demo generator), so that a crowd report arriving between
 * polls can recompute the estimate immediately without losing the
 * quick-turn signal or base airport context that produced it.
 */
const contexts = new Map<string, FlightMethodContext>();

function contextKey(flightId: string, phase: ReportPhase): string {
  return `${flightId}:${phase}`;
}

function computeFromContext(flightId: string, phase: ReportPhase, ctx: FlightMethodContext): MethodEstimate {
  const reportCounts = getReportCounts(flightId, phase);
  const reasoning: string[] = [];

  const lockedEntry = (Object.entries(reportCounts) as [BoardingMethod, number][]).find(
    ([, count]) => count >= LOCK_THRESHOLD,
  );
  if (lockedEntry) {
    const [method, count] = lockedEntry;
    return {
      method,
      probability: 1,
      confidenceLevel: 'confirmed',
      reasoning: [`${count} travelers on this exact flight reported boarding via ${methodLabel(method)}.`],
      reportCounts,
      reportsToConfirm: 0,
    };
  }

  let jetBridgeProb = ctx.baseShare;
  reasoning.push(ctx.baseReason);

  if (ctx.isQuickTurn) {
    jetBridgeProb = Math.max(jetBridgeProb, 0.85);
    reasoning.push('This aircraft is due to depart again within the hour — fast turnarounds are usually parked at bridge-served stands.');
  }

  const totalReports = Object.values(reportCounts).reduce((sum: number, c) => sum + (c ?? 0), 0);
  if (totalReports > 0) {
    const jetBridgeReports = reportCounts.jet_bridge ?? 0;
    const weight = Math.min(totalReports / LOCK_THRESHOLD, 1);
    jetBridgeProb = jetBridgeProb * (1 - weight) + (jetBridgeReports / totalReports) * weight;
    const leading = (Object.entries(reportCounts) as [BoardingMethod, number][]).sort((a, b) => b[1] - a[1])[0][0];
    reasoning.push(`${totalReports} traveler${totalReports > 1 ? 's' : ''} reported so far — most said ${methodLabel(leading)}.`);
  }

  const isJetBridge = jetBridgeProb >= 0.5;
  const method: BoardingMethod = isJetBridge ? 'jet_bridge' : tieBreakNonBridge(ctx.seed);
  const probability = isJetBridge ? jetBridgeProb : 1 - jetBridgeProb;
  const confidenceLevel: MethodConfidenceLevel = probability >= LIKELY_THRESHOLD ? 'likely' : 'uncertain';
  const leadingCount = Math.max(0, ...Object.values(reportCounts).map((c) => c ?? 0));

  return {
    method,
    probability,
    confidenceLevel,
    reasoning,
    reportCounts,
    reportsToConfirm: Math.max(0, LOCK_THRESHOLD - leadingCount),
  };
}

/** Computes the estimate for a newly-built flight and remembers the context so later reports can recompute it. */
export function estimateAndRegister(
  flightId: string,
  phase: ReportPhase,
  baseShare: number,
  baseReason: string,
  isQuickTurn: boolean,
  seed: string,
): MethodEstimate {
  const ctx: FlightMethodContext = { baseShare, baseReason, isQuickTurn, seed };
  contexts.set(contextKey(flightId, phase), ctx);
  return computeFromContext(flightId, phase, ctx);
}

/** Recomputes using the last-registered context, e.g. right after a new crowd report comes in. */
export function recomputeEstimate(flightId: string, phase: ReportPhase): MethodEstimate | undefined {
  const ctx = contexts.get(contextKey(flightId, phase));
  if (!ctx) return undefined;
  return computeFromContext(flightId, phase, ctx);
}
