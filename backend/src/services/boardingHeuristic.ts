import { BlrTerminal, TERMINAL_PROFILE } from '../data/airport';
import { BoardingMethod } from '../types';

function hashString(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  }
  return hash;
}

/**
 * Deterministically estimates jet bridge vs. shuttle bus boarding for a BLR
 * flight from its terminal and gate. No free flight API exposes this, so the
 * result is a stable-per-flight guess (same flight+gate always yields the
 * same answer) rather than a random flip, and callers must label it as an
 * estimate rather than confirmed data.
 */
export function estimateBoardingMethod(terminal: string, gate: string, flightNumber: string): BoardingMethod {
  const profile = TERMINAL_PROFILE[terminal as BlrTerminal] ?? TERMINAL_PROFILE.T1;
  const roll = hashString(`${terminal}:${gate}:${flightNumber}`) % 100;

  if (roll < profile.aerobridgeShare * 100) {
    return 'jet_bridge';
  }
  // T1's remote stands are typically bused; a smaller share involves a short walk.
  return roll % 5 === 0 ? 'walk_to_aircraft' : 'shuttle_bus';
}
