export const BLR_AIRPORT = {
  iata: 'BLR',
  icao: 'VOBL',
  name: 'Kempegowda International Airport',
  city: 'Bangalore',
  latitude: 13.1986,
  longitude: 77.7066,
} as const;

export type BlrTerminal = 'T1' | 'T2';

/**
 * Kempegowda International Airport has two terminals with meaningfully
 * different boarding experiences: T2 (opened 2022) is a modern, almost
 * entirely aerobridge-served terminal, while T1 is older and mixes
 * aerobridge gates with remote stands that board via shuttle bus. No free
 * API exposes bridge-vs-bus per flight, so this is used as the basis for
 * an honest, labeled estimate rather than presenting it as confirmed data.
 */
export const TERMINAL_PROFILE: Record<BlrTerminal, { aerobridgeShare: number }> = {
  T1: { aerobridgeShare: 0.4 },
  T2: { aerobridgeShare: 0.9 },
};
