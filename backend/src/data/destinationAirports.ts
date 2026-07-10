export interface DestinationProfile {
  name: string;
  timezone: string;
  /** Share of gates estimated to be aerobridge-served, used for the deplaning-method heuristic. */
  aerobridgeShare: number;
  /** Typical BLR sector time in minutes, used only to seed demo-mode arrival times. */
  typicalFlightMinutes: number;
}

/**
 * Curated for airports BLR realistically flies to. Bridge-vs-bus data isn't
 * published anywhere for free for any airport, so aerobridgeShare is a
 * judgment call from each airport's known terminal layout, not measured
 * data - always surfaced as "estimated" in the UI, never as confirmed.
 */
export const DESTINATION_PROFILES: Record<string, DestinationProfile> = {
  BLR: { name: 'Kempegowda International Airport', timezone: 'Asia/Kolkata', aerobridgeShare: 0.7, typicalFlightMinutes: 55 },
  CJB: { name: 'Coimbatore International Airport', timezone: 'Asia/Kolkata', aerobridgeShare: 0.5, typicalFlightMinutes: 55 },
  BOM: { name: 'Chhatrapati Shivaji Maharaj International Airport', timezone: 'Asia/Kolkata', aerobridgeShare: 0.75, typicalFlightMinutes: 95 },
  DEL: { name: 'Indira Gandhi International Airport', timezone: 'Asia/Kolkata', aerobridgeShare: 0.8, typicalFlightMinutes: 160 },
  HYD: { name: 'Rajiv Gandhi International Airport', timezone: 'Asia/Kolkata', aerobridgeShare: 0.85, typicalFlightMinutes: 60 },
  MAA: { name: 'Chennai International Airport', timezone: 'Asia/Kolkata', aerobridgeShare: 0.65, typicalFlightMinutes: 65 },
  PNQ: { name: 'Pune Airport', timezone: 'Asia/Kolkata', aerobridgeShare: 0.4, typicalFlightMinutes: 80 },
  DXB: { name: 'Dubai International Airport', timezone: 'Asia/Dubai', aerobridgeShare: 0.9, typicalFlightMinutes: 250 },
  SIN: { name: 'Singapore Changi Airport', timezone: 'Asia/Singapore', aerobridgeShare: 0.95, typicalFlightMinutes: 260 },
  LHR: { name: 'London Heathrow Airport', timezone: 'Europe/London', aerobridgeShare: 0.9, typicalFlightMinutes: 630 },
};

export const DEFAULT_DESTINATION_PROFILE: DestinationProfile = {
  name: 'the destination airport',
  timezone: 'UTC',
  aerobridgeShare: 0.6,
  typicalFlightMinutes: 120,
};

export function getDestinationProfile(iata: string): DestinationProfile {
  return DESTINATION_PROFILES[iata] ?? DEFAULT_DESTINATION_PROFILE;
}
