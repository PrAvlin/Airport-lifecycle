import { getOriginAirport, getTerminalProfile, isKnownOrigin } from './airports';

export interface DestinationProfile {
  name: string;
  city: string;
  timezone: string;
  /** Share of gates estimated to be aerobridge-served, used for the deplaning-method heuristic. */
  aerobridgeShare: number;
  /** Typical sector time in minutes, used only to seed demo-mode arrival times. */
  typicalFlightMinutes: number;
}

/** Used for a domestic destination outside our registered airport list (a very small regional strip). */
const DEFAULT_DESTINATION_PROFILE: DestinationProfile = {
  name: 'the destination airport',
  city: 'the destination city',
  timezone: 'Asia/Kolkata',
  aerobridgeShare: 0.5,
  typicalFlightMinutes: 120,
};

/**
 * Domestic-only, so every destination is just another entry in our own
 * airport registry (or the generic fallback for the rare small airport we
 * haven't added yet) - no separate international profile list needed.
 */
export function getDestinationProfile(iata: string): DestinationProfile {
  if (!isKnownOrigin(iata)) return DEFAULT_DESTINATION_PROFILE;
  const airport = getOriginAirport(iata);
  const profile = getTerminalProfile(airport, airport.defaultTerminal);
  return {
    name: airport.name,
    city: airport.city,
    timezone: airport.timezone,
    aerobridgeShare: profile.aerobridgeShare,
    typicalFlightMinutes: airport.typicalFlightMinutes,
  };
}
