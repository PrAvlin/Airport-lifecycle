export interface DestinationProfile {
  name: string;
  /** Short city name for compact UI display, e.g. flight list rows. */
  city: string;
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
  BLR: { name: 'Kempegowda International Airport', city: 'Bengaluru', timezone: 'Asia/Kolkata', aerobridgeShare: 0.7, typicalFlightMinutes: 55 },
  CJB: { name: 'Coimbatore International Airport', city: 'Coimbatore', timezone: 'Asia/Kolkata', aerobridgeShare: 0.5, typicalFlightMinutes: 55 },
  BOM: { name: 'Chhatrapati Shivaji Maharaj International Airport', city: 'Mumbai', timezone: 'Asia/Kolkata', aerobridgeShare: 0.75, typicalFlightMinutes: 95 },
  DEL: { name: 'Indira Gandhi International Airport', city: 'Delhi', timezone: 'Asia/Kolkata', aerobridgeShare: 0.8, typicalFlightMinutes: 160 },
  HYD: { name: 'Rajiv Gandhi International Airport', city: 'Hyderabad', timezone: 'Asia/Kolkata', aerobridgeShare: 0.85, typicalFlightMinutes: 60 },
  MAA: { name: 'Chennai International Airport', city: 'Chennai', timezone: 'Asia/Kolkata', aerobridgeShare: 0.65, typicalFlightMinutes: 65 },
  PNQ: { name: 'Pune Airport', city: 'Pune', timezone: 'Asia/Kolkata', aerobridgeShare: 0.4, typicalFlightMinutes: 80 },
  CCU: { name: 'Netaji Subhas Chandra Bose International Airport', city: 'Kolkata', timezone: 'Asia/Kolkata', aerobridgeShare: 0.6, typicalFlightMinutes: 150 },
  NAG: { name: 'Dr. Babasaheb Ambedkar International Airport', city: 'Nagpur', timezone: 'Asia/Kolkata', aerobridgeShare: 0.45, typicalFlightMinutes: 100 },
  IXE: { name: 'Mangalore International Airport', city: 'Mangalore', timezone: 'Asia/Kolkata', aerobridgeShare: 0.35, typicalFlightMinutes: 55 },
  DXB: { name: 'Dubai International Airport', city: 'Dubai', timezone: 'Asia/Dubai', aerobridgeShare: 0.9, typicalFlightMinutes: 250 },
  SIN: { name: 'Singapore Changi Airport', city: 'Singapore', timezone: 'Asia/Singapore', aerobridgeShare: 0.95, typicalFlightMinutes: 260 },
  LHR: { name: 'London Heathrow Airport', city: 'London', timezone: 'Europe/London', aerobridgeShare: 0.9, typicalFlightMinutes: 630 },
  KUL: { name: 'Kuala Lumpur International Airport', city: 'Kuala Lumpur', timezone: 'Asia/Kuala_Lumpur', aerobridgeShare: 0.85, typicalFlightMinutes: 275 },
  DPS: { name: 'Ngurah Rai International Airport', city: 'Denpasar (Bali)', timezone: 'Asia/Makassar', aerobridgeShare: 0.7, typicalFlightMinutes: 320 },
  BKK: { name: 'Suvarnabhumi Airport', city: 'Bangkok', timezone: 'Asia/Bangkok', aerobridgeShare: 0.9, typicalFlightMinutes: 270 },
};

export const DEFAULT_DESTINATION_PROFILE: DestinationProfile = {
  name: 'the destination airport',
  city: 'the destination city',
  timezone: 'UTC',
  aerobridgeShare: 0.6,
  typicalFlightMinutes: 120,
};

export function getDestinationProfile(iata: string): DestinationProfile {
  return DESTINATION_PROFILES[iata] ?? DEFAULT_DESTINATION_PROFILE;
}
