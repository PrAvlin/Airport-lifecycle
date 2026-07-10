import { findGateRule, getOriginAirport, getTerminalProfile, isKnownOrigin, OriginAirport } from '../data/airports';
import { getDestinationProfile } from '../data/destinationAirports';
import { getReportCounts, ReportPhase } from './boardingReports';
import { BoardingMethod, MethodConfidenceLevel, MethodEstimate } from '../types';

const LOCK_THRESHOLD = 3;
const LIKELY_THRESHOLD = 0.75;
// The aircraft-rotation signal floors the jet-bridge probability at this value.
const QUICK_TURN_JET_BRIDGE_PROB = 0.85;

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

interface EstimateInputs {
  /** Prior probability that boarding/deplaning is via jet bridge, before quick-turn and crowd signals. */
  baseJetBridgeProb: number;
  baseReasons: string[];
  /** When a gate rule matched, its exact non-bridge method (bus vs walk) — better than a hashed tie-break. */
  preferredNonBridgeMethod?: BoardingMethod;
  isQuickTurn: boolean;
  seed: string;
}

/**
 * Builds the boarding-side inputs for a flight at one of our origin
 * airports. Gate-level knowledge dominates when the gate is known: a
 * ground-level gate physically cannot have an aerobridge, and an
 * upper-level gate almost always does — so a matched gate rule replaces the
 * terminal-wide base rate instead of averaging with it.
 */
export function boardingInputs(airport: OriginAirport, terminal: string, gate: string): Omit<EstimateInputs, 'isQuickTurn' | 'seed'> {
  const gateRule = gate !== 'TBD' ? findGateRule(airport, terminal, gate) : undefined;
  if (gateRule) {
    const isBridge = gateRule.method === 'jet_bridge';
    return {
      baseJetBridgeProb: isBridge ? gateRule.probability : 1 - gateRule.probability,
      baseReasons: [`Gate ${gate} ${gateRule.note}.`],
      preferredNonBridgeMethod: isBridge ? undefined : gateRule.method,
    };
  }
  const profile = getTerminalProfile(airport, terminal);
  return { baseJetBridgeProb: profile.aerobridgeShare, baseReasons: [profile.reason] };
}

/**
 * Builds the deplaning-side inputs. If the destination happens to be one of
 * our own origin airports (BLR/MAA/CJB) and its arrival gate is already
 * known, the same gate-level physical-layout knowledge used for boarding
 * applies here too and dominates over the airport-wide profile.
 */
export function disembarkInputs(
  destinationIata: string,
  arrivalTerminal?: string,
  arrivalGate?: string,
): Omit<EstimateInputs, 'isQuickTurn' | 'seed'> {
  if (arrivalGate && arrivalGate !== 'TBD' && isKnownOrigin(destinationIata)) {
    const airport = getOriginAirport(destinationIata);
    const terminal = arrivalTerminal && arrivalTerminal !== 'TBD' ? arrivalTerminal : airport.defaultTerminal;
    const gateRule = findGateRule(airport, terminal, arrivalGate);
    if (gateRule) {
      const isBridge = gateRule.method === 'jet_bridge';
      return {
        baseJetBridgeProb: isBridge ? gateRule.probability : 1 - gateRule.probability,
        baseReasons: [`Arrival gate ${arrivalGate} ${gateRule.note}.`],
        preferredNonBridgeMethod: isBridge ? undefined : gateRule.method,
      };
    }
  }

  const profile = getDestinationProfile(destinationIata);
  const reason =
    profile.aerobridgeShare >= 0.85
      ? `${profile.name} is predominantly aerobridge-served.`
      : profile.aerobridgeShare <= 0.5
        ? `${profile.name} regularly uses remote stands reached by bus or a short walk.`
        : `${profile.name} uses a mix of aerobridge and remote stands.`;
  return { baseJetBridgeProb: profile.aerobridgeShare, baseReasons: [reason] };
}

/**
 * Registered whenever a flight is created/refreshed from the flight source
 * (live poll or demo generator), so that a crowd report arriving between
 * polls can recompute the estimate immediately without losing the gate,
 * quick-turn, or base airport context that produced it.
 */
const contexts = new Map<string, EstimateInputs>();

function contextKey(flightId: string, phase: ReportPhase): string {
  return `${flightId}:${phase}`;
}

function computeFromContext(flightId: string, phase: ReportPhase, ctx: EstimateInputs): MethodEstimate {
  const reportCounts = getReportCounts(flightId, phase);

  const lockedEntry = (Object.entries(reportCounts) as [BoardingMethod, number][]).find(
    ([, count]) => count >= LOCK_THRESHOLD,
  );
  if (lockedEntry) {
    const [method, count] = lockedEntry;
    return {
      method,
      probability: 1,
      confidenceLevel: 'confirmed',
      reasoning: [`${count} travelers on this exact flight reported ${methodLabel(method)}.`],
      reportCounts,
      reportsToConfirm: 0,
    };
  }

  let jetBridgeProb = ctx.baseJetBridgeProb;
  const reasoning = [...ctx.baseReasons];

  if (ctx.isQuickTurn) {
    if (jetBridgeProb < QUICK_TURN_JET_BRIDGE_PROB) {
      jetBridgeProb = QUICK_TURN_JET_BRIDGE_PROB;
    }
    reasoning.push('This aircraft is due out again within the hour — fast turnarounds are usually parked at bridge-served stands.');
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
  const method: BoardingMethod = isJetBridge
    ? 'jet_bridge'
    : ctx.preferredNonBridgeMethod ?? tieBreakNonBridge(ctx.seed);
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
  inputs: Omit<EstimateInputs, 'isQuickTurn' | 'seed'>,
  isQuickTurn: boolean,
  seed: string,
): MethodEstimate {
  const ctx: EstimateInputs = { ...inputs, isQuickTurn, seed };
  contexts.set(contextKey(flightId, phase), ctx);
  return computeFromContext(flightId, phase, ctx);
}

/** Recomputes using the last-registered context, e.g. right after a new crowd report comes in. */
export function recomputeEstimate(flightId: string, phase: ReportPhase): MethodEstimate | undefined {
  const ctx = contexts.get(contextKey(flightId, phase));
  if (!ctx) return undefined;
  return computeFromContext(flightId, phase, ctx);
}
