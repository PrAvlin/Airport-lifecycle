import { BoardingMethod } from '../types';

export interface Locality {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  /** Fallback estimate used when no TomTom API key is configured (no live traffic). */
  typicalMinutesNoTraffic: number;
}

export interface TerminalProfile {
  aerobridgeShare: number;
  reason: string;
}

/**
 * Gate-level knowledge. The physical layout is the giveaway: a ground-level
 * gate cannot have an aerobridge (there's nothing to bridge to), while an
 * upper-level gate almost always does. So when the gate number is known,
 * this beats the terminal-wide average by a wide margin. These maps are
 * curated approximations of each airport's layout and get corrected by
 * crowd reports when wrong.
 */
export interface GateRule {
  terminal: string;
  gates: string[];
  method: BoardingMethod;
  probability: number;
  note: string;
}

export interface OriginAirport {
  iata: string;
  icao: string;
  name: string;
  city: string;
  latitude: number;
  longitude: number;
  timezone: string;
  terminals: Record<string, TerminalProfile>;
  defaultTerminal: string;
  gateRules: GateRule[];
  localities: Locality[];
}

export const ORIGIN_AIRPORTS: Record<string, OriginAirport> = {
  BLR: {
    iata: 'BLR',
    icao: 'VOBL',
    name: 'Kempegowda International Airport',
    city: 'Bengaluru',
    latitude: 13.1986,
    longitude: 77.7066,
    timezone: 'Asia/Kolkata',
    terminals: {
      T1: { aerobridgeShare: 0.4, reason: 'T1 is an older terminal that mixes aerobridge gates with remote stands reached by bus.' },
      T2: { aerobridgeShare: 0.9, reason: 'T2 is a modern terminal where nearly all gates use aerobridges.' },
    },
    defaultTerminal: 'T1',
    gateRules: [
      { terminal: 'T1', gates: ['1', '2', '3', '4', '5', '6', '7', '8', '9'], method: 'shuttle_bus', probability: 0.9, note: 'is a ground-level gate at T1 — ground-floor gates board by bus across the apron' },
      { terminal: 'T1', gates: ['10', '11', '12', '13', '14', '15', '16', '17', '18'], method: 'aerobridge', probability: 0.93, note: 'is an upper-level contact gate at T1 — these connect straight to an aerobridge' },
      { terminal: 'T2', gates: ['20', '21', '22', '23', '24', '25', '26', '27', '28', '29', '30', '31'], method: 'aerobridge', probability: 0.95, note: 'is an upper-level contact gate at T2 — aerobridge boarding' },
      { terminal: 'T2', gates: ['40', '41', '42', '43'], method: 'shuttle_bus', probability: 0.9, note: 'is a ground-level bus gate at T2' },
    ],
    localities: [
      { id: 'mg-road', name: 'MG Road / City Centre', latitude: 12.9756, longitude: 77.6068, typicalMinutesNoTraffic: 45 },
      { id: 'koramangala', name: 'Koramangala', latitude: 12.9352, longitude: 77.6245, typicalMinutesNoTraffic: 55 },
      { id: 'indiranagar', name: 'Indiranagar', latitude: 12.9719, longitude: 77.6412, typicalMinutesNoTraffic: 42 },
      { id: 'whitefield', name: 'Whitefield', latitude: 12.9698, longitude: 77.75, typicalMinutesNoTraffic: 50 },
      { id: 'electronic-city', name: 'Electronic City', latitude: 12.8452, longitude: 77.6602, typicalMinutesNoTraffic: 75 },
      { id: 'hebbal', name: 'Hebbal', latitude: 13.0356, longitude: 77.597, typicalMinutesNoTraffic: 25 },
      { id: 'yeshwanthpur', name: 'Yeshwanthpur', latitude: 13.0284, longitude: 77.554, typicalMinutesNoTraffic: 35 },
      { id: 'jayanagar', name: 'Jayanagar', latitude: 12.9308, longitude: 77.5838, typicalMinutesNoTraffic: 55 },
    ],
  },

  MAA: {
    iata: 'MAA',
    icao: 'VOMM',
    name: 'Chennai International Airport',
    city: 'Chennai',
    latitude: 12.9941,
    longitude: 80.1709,
    timezone: 'Asia/Kolkata',
    terminals: {
      T1: { aerobridgeShare: 0.7, reason: 'T1 (domestic) has a good number of aerobridge gates but still uses ground-level bus gates at peak times.' },
      T2: { aerobridgeShare: 0.8, reason: 'T2 (the new integrated international terminal) is mostly aerobridge-served with some remote stands.' },
    },
    defaultTerminal: 'T1',
    gateRules: [
      { terminal: 'T1', gates: ['1', '2', '3', '4', '5', '6'], method: 'aerobridge', probability: 0.92, note: 'is an upper-level contact gate at Chennai T1 — aerobridge boarding' },
      { terminal: 'T1', gates: ['7', '8', '9', '10'], method: 'shuttle_bus', probability: 0.9, note: 'is a ground-level gate at Chennai T1 — ground-floor gates board by bus' },
      { terminal: 'T2', gates: ['11', '12', '13', '14', '15', '16', '17'], method: 'aerobridge', probability: 0.93, note: 'is an upper-level contact gate at Chennai T2 — aerobridge boarding' },
      { terminal: 'T2', gates: ['18', '19', '20'], method: 'shuttle_bus', probability: 0.88, note: 'is a ground-level bus gate at Chennai T2' },
    ],
    localities: [
      { id: 't-nagar', name: 'T. Nagar', latitude: 13.0418, longitude: 80.2341, typicalMinutesNoTraffic: 35 },
      { id: 'anna-nagar', name: 'Anna Nagar', latitude: 13.085, longitude: 80.2101, typicalMinutesNoTraffic: 45 },
      { id: 'velachery', name: 'Velachery', latitude: 12.9755, longitude: 80.2201, typicalMinutesNoTraffic: 30 },
      { id: 'omr-sholinganallur', name: 'OMR / Sholinganallur', latitude: 12.901, longitude: 80.2279, typicalMinutesNoTraffic: 45 },
      { id: 'guindy', name: 'Guindy', latitude: 13.0067, longitude: 80.2206, typicalMinutesNoTraffic: 20 },
      { id: 'tambaram', name: 'Tambaram', latitude: 12.9249, longitude: 80.1, typicalMinutesNoTraffic: 30 },
    ],
  },

  CJB: {
    iata: 'CJB',
    icao: 'VOCB',
    name: 'Coimbatore International Airport',
    city: 'Coimbatore',
    latitude: 11.0297,
    longitude: 77.0436,
    timezone: 'Asia/Kolkata',
    terminals: {
      T1: { aerobridgeShare: 0.5, reason: 'Coimbatore has only two aerobridges; other stands are reached by shuttle bus across the apron.' },
    },
    defaultTerminal: 'T1',
    gateRules: [
      { terminal: 'T1', gates: ['1', '2'], method: 'aerobridge', probability: 0.9, note: 'is one of Coimbatore’s two aerobridge gates' },
      { terminal: 'T1', gates: ['3', '4'], method: 'shuttle_bus', probability: 0.85, note: 'is a ground-level gate at Coimbatore — boards by shuttle bus across the apron' },
    ],
    localities: [
      { id: 'gandhipuram', name: 'Gandhipuram', latitude: 11.0183, longitude: 76.9725, typicalMinutesNoTraffic: 30 },
      { id: 'rs-puram', name: 'RS Puram', latitude: 11.0055, longitude: 76.9508, typicalMinutesNoTraffic: 35 },
      { id: 'peelamedu', name: 'Peelamedu', latitude: 11.0301, longitude: 77.0296, typicalMinutesNoTraffic: 12 },
      { id: 'saravanampatti', name: 'Saravanampatti', latitude: 11.0768, longitude: 77.0069, typicalMinutesNoTraffic: 25 },
      { id: 'singanallur', name: 'Singanallur', latitude: 11.0002, longitude: 77.0308, typicalMinutesNoTraffic: 18 },
      { id: 'ukkadam', name: 'Ukkadam', latitude: 10.9925, longitude: 76.9608, typicalMinutesNoTraffic: 35 },
    ],
  },
};

export const DEFAULT_ORIGIN = 'BLR';

export function getOriginAirport(iata: string | undefined): OriginAirport {
  return ORIGIN_AIRPORTS[(iata ?? DEFAULT_ORIGIN).toUpperCase()] ?? ORIGIN_AIRPORTS[DEFAULT_ORIGIN];
}

export function isKnownOrigin(iata: string): boolean {
  return iata.toUpperCase() in ORIGIN_AIRPORTS;
}

export function findGateRule(airport: OriginAirport, terminal: string, gate: string): GateRule | undefined {
  return airport.gateRules.find((rule) => rule.terminal === terminal && rule.gates.includes(gate));
}

export function getTerminalProfile(airport: OriginAirport, terminal: string): TerminalProfile {
  return airport.terminals[terminal] ?? airport.terminals[airport.defaultTerminal];
}

export function findLocality(airport: OriginAirport, id: string): Locality | undefined {
  return airport.localities.find((loc) => loc.id === id);
}
