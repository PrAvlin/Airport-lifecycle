import { BlrTerminal, TERMINAL_PROFILE } from '../data/airport';
import { getDestinationProfile } from '../data/destinationAirports';
import { BoardingMethod } from '../types';

function hashString(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function methodFromAerobridgeShare(aerobridgeShare: number, seed: string): BoardingMethod {
  const roll = hashString(seed) % 100;
  if (roll < aerobridgeShare * 100) return 'jet_bridge';
  // A smaller remaining share involves a short walk rather than a bus.
  return roll % 5 === 0 ? 'walk_to_aircraft' : 'shuttle_bus';
}

// Airlines prioritize contact/aerobridge stands for aircraft turning around
// quickly, since bussing passengers on and off costs time a fast turn can't
// spare. When we can see (from real schedule data) that the same airframe
// arrived and is due out again within this window, that's a real signal the
// stand is bridge-served - not a guess.
const QUICK_TURN_AEROBRIDGE_SHARE = 0.92;

/**
 * Deterministically estimates jet bridge vs. shuttle bus boarding for a BLR
 * departure from its terminal and gate. No free flight API exposes this, so
 * the result is a stable-per-flight guess (same flight+gate always yields
 * the same answer) rather than a random flip, and callers must label it as
 * an estimate rather than confirmed data. `isQuickTurn` lets a caller who has
 * cross-referenced the aircraft's actual rotation bias the estimate.
 */
export function estimateBoardingMethod(
  terminal: string,
  gate: string,
  flightNumber: string,
  isQuickTurn = false,
): BoardingMethod {
  const profile = TERMINAL_PROFILE[terminal as BlrTerminal] ?? TERMINAL_PROFILE.T1;
  const share = isQuickTurn ? Math.max(profile.aerobridgeShare, QUICK_TURN_AEROBRIDGE_SHARE) : profile.aerobridgeShare;
  return methodFromAerobridgeShare(share, `board:${terminal}:${gate}:${flightNumber}`);
}

/**
 * Same idea for deplaning at the destination airport. Destination can be
 * any airport BLR flies to, so this falls back to a generic profile for
 * anything not in the curated destination table.
 */
export function estimateDisembarkMethod(
  destinationIata: string,
  terminal: string,
  flightNumber: string,
  isQuickTurn = false,
): BoardingMethod {
  const profile = getDestinationProfile(destinationIata);
  const share = isQuickTurn ? Math.max(profile.aerobridgeShare, QUICK_TURN_AEROBRIDGE_SHARE) : profile.aerobridgeShare;
  return methodFromAerobridgeShare(share, `deplane:${destinationIata}:${terminal}:${flightNumber}`);
}
