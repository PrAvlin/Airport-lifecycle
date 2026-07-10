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
 * this beats the terminal-wide average by a wide margin. Real, curated gate
 * maps only exist for BLR, MAA, and CJB so far - everywhere else falls back
 * honestly to the terminal-wide average until a specific gate is confirmed
 * by enough crowd reports.
 */
export interface GateRule {
  terminal: string;
  gates: string[];
  method: BoardingMethod;
  probability: number;
  note: string;
}

export interface IndianAirport {
  iata: string;
  icao: string;
  name: string;
  city: string;
  latitude: number;
  longitude: number;
  timezone: string;
  /** Typical BLR-equivalent sector time in minutes, used only to seed demo-mode arrival times. */
  typicalFlightMinutes: number;
  terminals: Record<string, TerminalProfile>;
  defaultTerminal: string;
  gateRules: GateRule[];
  /**
   * City-side pickup points for the "traffic to the airport" feature. Only
   * populated for airports we expect people to actually search this app
   * from as an origin - still usable as a destination without them.
   */
  localities: Locality[];
}

/** Kept as an alias so existing imports (OriginAirport) don't need renaming everywhere. */
export type OriginAirport = IndianAirport;

/**
 * Domestic-only registry of major Indian airports. Real, verified gate-level
 * layouts only exist for BLR/MAA/CJB (see each terminal's `reason` text for
 * what's actually confirmed vs. a general estimate) - every other airport
 * here uses an honest terminal-wide base rate until crowd reports or a
 * confirmed gate narrow it down.
 */
export const ORIGIN_AIRPORTS: Record<string, IndianAirport> = {
  BLR: {
    iata: 'BLR',
    icao: 'VOBL',
    name: 'Kempegowda International Airport',
    city: 'Bengaluru',
    latitude: 13.1986,
    longitude: 77.7066,
    timezone: 'Asia/Kolkata',
    typicalFlightMinutes: 55,
    terminals: {
      T1: { aerobridgeShare: 0.64, reason: 'T1 mixes aerobridge and ground-level bus gates across its numbering — roughly 25 of its ~39 gates are aerobridge-served.' },
      T2: { aerobridgeShare: 0.9, reason: 'T2 is a modern terminal where nearly all gates use aerobridges.' },
    },
    defaultTerminal: 'T1',
    gateRules: [
      { terminal: 'T1', gates: ['1', '2'], method: 'aerobridge', probability: 0.95, note: 'is an aerobridge gate at T1' },
      { terminal: 'T1', gates: ['3', '4', '5', '6', '7', '8', '9'], method: 'shuttle_bus', probability: 0.95, note: 'is a ground-level bus gate at T1' },
      { terminal: 'T1', gates: ['12', '13', '14', '15', '16', '17', '18'], method: 'aerobridge', probability: 0.95, note: 'is an aerobridge gate at T1' },
      { terminal: 'T1', gates: ['19', '20', '21', '22', '23', '24', '25'], method: 'shuttle_bus', probability: 0.95, note: 'is a ground-level bus gate at T1' },
      { terminal: 'T1', gates: ['28', '29', '30', '31', '32', '33', '34', '35', '36', '37', '38', '39', '40', '41', '42', '43'], method: 'aerobridge', probability: 0.95, note: 'is an aerobridge gate at T1' },
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
    typicalFlightMinutes: 65,
    terminals: {
      // T1 domestic has 9 boarding gates total: 3 on the upper level (aerobridge) and
      // 6 on the ground level (bus) - confirmed via public airport-facility sources, but
      // which specific gate numbers are which isn't published, so we can't do gate-level
      // rules here the way we can for BLR/CJB - this terminal-wide rate is the honest ceiling.
      T1: { aerobridgeShare: 0.33, reason: "T1 (domestic) has 9 gates total: only 3 are on the upper level served by aerobridge, the other 6 board by bus from the ground level." },
      T2: { aerobridgeShare: 0.85, reason: 'The international terminal complex has 13 aerobridges and is predominantly contact-gate served.' },
    },
    defaultTerminal: 'T1',
    gateRules: [],
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
    typicalFlightMinutes: 55,
    terminals: {
      T1: { aerobridgeShare: 0.5, reason: 'Coimbatore currently has 2 aerobridges; other stands are reached by shuttle bus across the apron.' },
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

  DEL: {
    iata: 'DEL',
    icao: 'VIDP',
    name: 'Indira Gandhi International Airport',
    city: 'Delhi',
    latitude: 28.5562,
    longitude: 77.1,
    timezone: 'Asia/Kolkata',
    typicalFlightMinutes: 160,
    terminals: {
      T1: { aerobridgeShare: 0.5, reason: 'T1 (budget domestic) confirmed to use bus boarding for at least part of its gates; exact split not published.' },
      T3: { aerobridgeShare: 0.47, reason: 'T3 has 48 contact stands (78 aerobridges, some wide-body stands use two) alongside 54 remote parking bays — under half the total stands are actually contact.' },
    },
    defaultTerminal: 'T3',
    gateRules: [],
    localities: [
      { id: 'connaught-place', name: 'Connaught Place', latitude: 28.6315, longitude: 77.2167, typicalMinutesNoTraffic: 35 },
      { id: 'gurgaon', name: 'Gurgaon', latitude: 28.4595, longitude: 77.0266, typicalMinutesNoTraffic: 40 },
      { id: 'dwarka', name: 'Dwarka', latitude: 28.5921, longitude: 77.046, typicalMinutesNoTraffic: 20 },
      { id: 'noida', name: 'Noida', latitude: 28.5355, longitude: 77.391, typicalMinutesNoTraffic: 55 },
    ],
  },

  BOM: {
    iata: 'BOM',
    icao: 'VABB',
    name: 'Chhatrapati Shivaji Maharaj International Airport',
    city: 'Mumbai',
    latitude: 19.0896,
    longitude: 72.8656,
    timezone: 'Asia/Kolkata',
    typicalFlightMinutes: 95,
    terminals: {
      T1: { aerobridgeShare: 0.4, reason: 'T1 has 11 boarding bridges across its 1A/1B/1C piers, with confirmed bus boarding at some gates (see gate map for the 1C pier specifically).' },
      T2: { aerobridgeShare: 0.85, reason: 'T2 was built with 48 contact stands (52 aerobridges) in its original design — a mostly-aerobridge terminal.' },
    },
    defaultTerminal: 'T2',
    gateRules: [
      { terminal: 'T1', gates: ['21', '22', '23', '24', '25'], method: 'aerobridge', probability: 0.9, note: 'is an aerobridge gate on the T1C pier' },
      { terminal: 'T1', gates: ['29', '30', '31'], method: 'shuttle_bus', probability: 0.9, note: 'is a bus-boarding gate on the T1C pier' },
    ],
    localities: [
      { id: 'bandra', name: 'Bandra', latitude: 19.0596, longitude: 72.8295, typicalMinutesNoTraffic: 25 },
      { id: 'andheri', name: 'Andheri', latitude: 19.1197, longitude: 72.8468, typicalMinutesNoTraffic: 15 },
      { id: 'colaba', name: 'Colaba / South Mumbai', latitude: 18.9067, longitude: 72.8147, typicalMinutesNoTraffic: 45 },
      { id: 'powai', name: 'Powai', latitude: 19.1176, longitude: 72.906, typicalMinutesNoTraffic: 30 },
    ],
  },

  HYD: {
    iata: 'HYD',
    icao: 'VOHS',
    name: 'Rajiv Gandhi International Airport',
    city: 'Hyderabad',
    latitude: 17.2403,
    longitude: 78.4294,
    timezone: 'Asia/Kolkata',
    typicalFlightMinutes: 60,
    terminals: {
      T1: { aerobridgeShare: 0.44, reason: 'The terminal has 44 aerobridges against 56 remote bus-boarding domestic gates — under half of gates are contact.' },
    },
    defaultTerminal: 'T1',
    gateRules: [],
    localities: [
      { id: 'hitech-city', name: 'HITEC City', latitude: 17.4483, longitude: 78.3915, typicalMinutesNoTraffic: 45 },
      { id: 'banjara-hills', name: 'Banjara Hills', latitude: 17.4156, longitude: 78.4347, typicalMinutesNoTraffic: 40 },
      { id: 'secunderabad', name: 'Secunderabad', latitude: 17.4399, longitude: 78.4983, typicalMinutesNoTraffic: 50 },
    ],
  },

  CCU: {
    iata: 'CCU',
    icao: 'VECC',
    name: 'Netaji Subhas Chandra Bose International Airport',
    city: 'Kolkata',
    latitude: 22.652,
    longitude: 88.4463,
    timezone: 'Asia/Kolkata',
    typicalFlightMinutes: 150,
    terminals: {
      // Kolkata actually runs one single integrated terminal (T2) for both
      // domestic and international - 18 aerobridges against 57 remote
      // parking bays, so contact stands are a clear minority (~24%).
      T1: { aerobridgeShare: 0.24, reason: 'Kolkata is one single integrated terminal with 18 aerobridges against 57 remote parking bays — most stands are remote.' },
      T2: { aerobridgeShare: 0.24, reason: 'Kolkata is one single integrated terminal with 18 aerobridges against 57 remote parking bays — most stands are remote.' },
    },
    defaultTerminal: 'T1',
    gateRules: [],
    localities: [
      { id: 'salt-lake', name: 'Salt Lake City', latitude: 22.5867, longitude: 88.4172, typicalMinutesNoTraffic: 25 },
      { id: 'park-street', name: 'Park Street / City Centre', latitude: 22.5535, longitude: 88.3517, typicalMinutesNoTraffic: 40 },
      { id: 'howrah', name: 'Howrah', latitude: 22.5958, longitude: 88.2636, typicalMinutesNoTraffic: 55 },
    ],
  },

  PNQ: {
    iata: 'PNQ',
    icao: 'VAPO',
    name: 'Pune Airport',
    city: 'Pune',
    latitude: 18.5822,
    longitude: 73.9197,
    timezone: 'Asia/Kolkata',
    typicalFlightMinutes: 80,
    terminals: {
      T1: { aerobridgeShare: 0.75, reason: 'All 10 of Pune\'s aerobridges are now operational (5 new terminal + 5 old), which recently eliminated most routine bus boarding.' },
    },
    defaultTerminal: 'T1',
    gateRules: [],
    localities: [
      { id: 'koregaon-park', name: 'Koregaon Park', latitude: 18.5362, longitude: 73.8938, typicalMinutesNoTraffic: 20 },
      { id: 'hinjewadi', name: 'Hinjewadi', latitude: 18.5913, longitude: 73.7389, typicalMinutesNoTraffic: 50 },
      { id: 'kothrud', name: 'Kothrud', latitude: 18.5074, longitude: 73.8077, typicalMinutesNoTraffic: 35 },
    ],
  },

  AMD: {
    iata: 'AMD',
    icao: 'VAAH',
    name: 'Sardar Vallabhbhai Patel International Airport',
    city: 'Ahmedabad',
    latitude: 23.0772,
    longitude: 72.6347,
    timezone: 'Asia/Kolkata',
    typicalFlightMinutes: 90,
    terminals: {
      T1: { aerobridgeShare: 0.35, reason: 'The domestic terminal has only 4 aerobridges total, so most gates are reached by bus.' },
      T2: { aerobridgeShare: 0.55, reason: 'The international terminal also has just 4 aerobridges, similarly bus-heavy.' },
    },
    defaultTerminal: 'T1',
    gateRules: [],
    localities: [
      { id: 'satellite', name: 'Satellite', latitude: 23.0225, longitude: 72.5227, typicalMinutesNoTraffic: 30 },
      { id: 'navrangpura', name: 'Navrangpura', latitude: 23.0365, longitude: 72.5609, typicalMinutesNoTraffic: 25 },
    ],
  },

  GOI: {
    iata: 'GOI',
    icao: 'VOGO',
    name: 'Goa International Airport (Dabolim)',
    city: 'Goa',
    latitude: 15.3808,
    longitude: 73.8314,
    timezone: 'Asia/Kolkata',
    typicalFlightMinutes: 130,
    terminals: {
      T1: { aerobridgeShare: 0.45, reason: '8 aerobridges are currently operational, out of a planned eventual 16 — call it a coin flip today.' },
    },
    defaultTerminal: 'T1',
    gateRules: [],
    localities: [
      { id: 'panaji', name: 'Panaji', latitude: 15.4909, longitude: 73.8278, typicalMinutesNoTraffic: 40 },
      { id: 'calangute', name: 'Calangute', latitude: 15.5439, longitude: 73.7553, typicalMinutesNoTraffic: 60 },
    ],
  },

  COK: {
    iata: 'COK',
    icao: 'VOCI',
    name: 'Cochin International Airport',
    city: 'Kochi',
    latitude: 10.152,
    longitude: 76.4019,
    timezone: 'Asia/Kolkata',
    typicalFlightMinutes: 100,
    terminals: {
      T1: { aerobridgeShare: 0.45, reason: 'The domestic terminal (renovated 2018) has 7 aerobridges against a larger total gate count, so remote stands are still common.' },
      T3: { aerobridgeShare: 0.85, reason: 'The newer international terminal is mostly aerobridge-served.' },
    },
    defaultTerminal: 'T1',
    gateRules: [],
    localities: [
      { id: 'ernakulam', name: 'Ernakulam', latitude: 9.9816, longitude: 76.2999, typicalMinutesNoTraffic: 40 },
      { id: 'kakkanad', name: 'Kakkanad', latitude: 10.0158, longitude: 76.3419, typicalMinutesNoTraffic: 30 },
    ],
  },

  JAI: {
    iata: 'JAI',
    icao: 'VIJP',
    name: 'Jaipur International Airport',
    city: 'Jaipur',
    latitude: 26.8242,
    longitude: 75.8122,
    timezone: 'Asia/Kolkata',
    typicalFlightMinutes: 75,
    terminals: {
      T2: { aerobridgeShare: 0.4, reason: 'The domestic terminal has 10 boarding gates but only a handful of aerobridges (more being added), so most gates are still bus-boarded.' },
    },
    defaultTerminal: 'T2',
    gateRules: [],
    localities: [
      { id: 'c-scheme', name: 'C-Scheme', latitude: 26.9124, longitude: 75.7873, typicalMinutesNoTraffic: 30 },
      { id: 'malviya-nagar', name: 'Malviya Nagar', latitude: 26.8514, longitude: 75.8042, typicalMinutesNoTraffic: 15 },
    ],
  },

  LKO: {
    iata: 'LKO',
    icao: 'VILK',
    name: 'Chaudhary Charan Singh International Airport',
    city: 'Lucknow',
    latitude: 26.7606,
    longitude: 80.8893,
    timezone: 'Asia/Kolkata',
    typicalFlightMinutes: 100,
    terminals: {
      T3: { aerobridgeShare: 0.4, reason: 'Around 6 aerobridges (expanding to 8) against at least 15 departure gates — most gates are still bus-boarded.' },
    },
    defaultTerminal: 'T3',
    gateRules: [],
    localities: [
      { id: 'hazratganj', name: 'Hazratganj', latitude: 26.8532, longitude: 80.9469, typicalMinutesNoTraffic: 35 },
      { id: 'gomti-nagar', name: 'Gomti Nagar', latitude: 26.8506, longitude: 81.0169, typicalMinutesNoTraffic: 40 },
    ],
  },

  IXC: {
    iata: 'IXC',
    icao: 'VICG',
    name: 'Chandigarh Airport',
    city: 'Chandigarh',
    latitude: 30.6735,
    longitude: 76.7885,
    timezone: 'Asia/Kolkata',
    typicalFlightMinutes: 90,
    terminals: {
      T1: { aerobridgeShare: 0.43, reason: '6 contact gates against 8 remote parking stands — a near-even split, slightly bus-favored.' },
    },
    defaultTerminal: 'T1',
    gateRules: [],
    localities: [
      { id: 'sector-17', name: 'Sector 17', latitude: 30.7409, longitude: 76.7828, typicalMinutesNoTraffic: 30 },
    ],
  },

  PAT: {
    iata: 'PAT',
    icao: 'VEPT',
    name: 'Jay Prakash Narayan Airport',
    city: 'Patna',
    latitude: 25.5913,
    longitude: 85.088,
    timezone: 'Asia/Kolkata',
    typicalFlightMinutes: 130,
    terminals: {
      T1: { aerobridgeShare: 0.3, reason: 'A smaller airport that relies mostly on remote stands reached by bus.' },
    },
    defaultTerminal: 'T1',
    gateRules: [],
    localities: [
      { id: 'boring-road', name: 'Boring Road', latitude: 25.6134, longitude: 85.1211, typicalMinutesNoTraffic: 25 },
    ],
  },

  BBI: {
    iata: 'BBI',
    icao: 'VEBS',
    name: 'Biju Patnaik International Airport',
    city: 'Bhubaneswar',
    latitude: 20.2444,
    longitude: 85.8178,
    timezone: 'Asia/Kolkata',
    typicalFlightMinutes: 145,
    terminals: {
      T1: { aerobridgeShare: 0.5, reason: 'T1 has just 4 aerobridges (6 more planned for the upcoming T3 expansion) — call it a coin flip today.' },
    },
    defaultTerminal: 'T1',
    gateRules: [],
    localities: [
      { id: 'saheed-nagar', name: 'Saheed Nagar', latitude: 20.2843, longitude: 85.8434, typicalMinutesNoTraffic: 20 },
    ],
  },

  IDR: {
    iata: 'IDR',
    icao: 'VAID',
    name: 'Devi Ahilyabai Holkar Airport',
    city: 'Indore',
    latitude: 22.7218,
    longitude: 75.8011,
    timezone: 'Asia/Kolkata',
    typicalFlightMinutes: 100,
    terminals: {
      T2: { aerobridgeShare: 0.45, reason: '5 aerobridges among 11 gates total (8 on the upper floor, 3 on the ground floor, which can never be aerobridge).' },
    },
    defaultTerminal: 'T2',
    gateRules: [],
    localities: [
      { id: 'vijay-nagar', name: 'Vijay Nagar', latitude: 22.7531, longitude: 75.8937, typicalMinutesNoTraffic: 25 },
    ],
  },

  VNS: {
    iata: 'VNS',
    icao: 'VEBN',
    name: 'Lal Bahadur Shastri Airport',
    city: 'Varanasi',
    latitude: 25.4524,
    longitude: 82.8593,
    timezone: 'Asia/Kolkata',
    typicalFlightMinutes: 110,
    terminals: {
      T1: { aerobridgeShare: 0.25, reason: 'Only 2 aerobridges serve the terminal — most gates are reached on foot or by shuttle across the apron.' },
    },
    defaultTerminal: 'T1',
    gateRules: [],
    localities: [
      { id: 'godowlia', name: 'Godowlia / City Centre', latitude: 25.3095, longitude: 83.0085, typicalMinutesNoTraffic: 45 },
    ],
  },

  GAU: {
    iata: 'GAU',
    icao: 'VEGT',
    name: 'Lokpriya Gopinath Bordoloi International Airport',
    city: 'Guwahati',
    latitude: 26.1061,
    longitude: 91.5859,
    timezone: 'Asia/Kolkata',
    typicalFlightMinutes: 165,
    terminals: {
      T1: { aerobridgeShare: 0.7, reason: 'The brand-new T2 terminal ("The Bamboo Orchids", opened 2026) has 10 aerobridges, a big step up from the older terminal passengers described as short on bridges.' },
    },
    defaultTerminal: 'T1',
    gateRules: [],
    localities: [
      { id: 'paltan-bazaar', name: 'Paltan Bazaar / City Centre', latitude: 26.1833, longitude: 91.7458, typicalMinutesNoTraffic: 35 },
    ],
  },

  RPR: {
    iata: 'RPR',
    icao: 'VARP',
    name: 'Swami Vivekananda Airport',
    city: 'Raipur',
    latitude: 21.1804,
    longitude: 81.7388,
    timezone: 'Asia/Kolkata',
    typicalFlightMinutes: 120,
    terminals: {
      T1: { aerobridgeShare: 0.35, reason: 'A smaller airport that relies mostly on remote stands reached by bus.' },
    },
    defaultTerminal: 'T1',
    gateRules: [],
    localities: [
      { id: 'raipur-city', name: 'City Centre', latitude: 21.2514, longitude: 81.6296, typicalMinutesNoTraffic: 30 },
    ],
  },

  IXR: {
    iata: 'IXR',
    icao: 'VERC',
    name: 'Birsa Munda Airport',
    city: 'Ranchi',
    latitude: 23.3143,
    longitude: 85.3217,
    timezone: 'Asia/Kolkata',
    typicalFlightMinutes: 130,
    terminals: {
      T1: { aerobridgeShare: 0.35, reason: 'A smaller airport that relies mostly on remote stands reached by bus.' },
    },
    defaultTerminal: 'T1',
    gateRules: [],
    localities: [
      { id: 'ranchi-city', name: 'City Centre', latitude: 23.3441, longitude: 85.3096, typicalMinutesNoTraffic: 30 },
    ],
  },

  TRV: {
    iata: 'TRV',
    icao: 'VOTV',
    name: 'Trivandrum International Airport',
    city: 'Thiruvananthapuram',
    latitude: 8.4821,
    longitude: 76.92,
    timezone: 'Asia/Kolkata',
    typicalFlightMinutes: 115,
    terminals: {
      T1: { aerobridgeShare: 0.55, reason: 'A mix of aerobridge and remote stands.' },
    },
    defaultTerminal: 'T1',
    gateRules: [],
    localities: [
      { id: 'trivandrum-city', name: 'City Centre', latitude: 8.5241, longitude: 76.9366, typicalMinutesNoTraffic: 25 },
    ],
  },

  NAG: {
    iata: 'NAG',
    icao: 'VANP',
    name: 'Dr. Babasaheb Ambedkar International Airport',
    city: 'Nagpur',
    latitude: 21.0922,
    longitude: 79.0472,
    timezone: 'Asia/Kolkata',
    typicalFlightMinutes: 100,
    terminals: {
      T1: { aerobridgeShare: 0.45, reason: 'A mix of aerobridge and remote stands.' },
    },
    defaultTerminal: 'T1',
    gateRules: [],
    localities: [
      { id: 'nagpur-city', name: 'City Centre', latitude: 21.1458, longitude: 79.0882, typicalMinutesNoTraffic: 25 },
    ],
  },

  IXE: {
    iata: 'IXE',
    icao: 'VOML',
    name: 'Mangalore International Airport',
    city: 'Mangalore',
    latitude: 12.9613,
    longitude: 74.89,
    timezone: 'Asia/Kolkata',
    typicalFlightMinutes: 55,
    terminals: {
      T1: { aerobridgeShare: 0.35, reason: 'A smaller airport that relies mostly on remote stands reached by bus.' },
    },
    defaultTerminal: 'T1',
    gateRules: [],
    localities: [
      { id: 'mangalore-city', name: 'City Centre', latitude: 12.9141, longitude: 74.856, typicalMinutesNoTraffic: 35 },
    ],
  },
};

/** Used for a domestic destination we haven't curated at all yet (very small regional airports). */
export const DEFAULT_TERMINAL_PROFILE: TerminalProfile = {
  aerobridgeShare: 0.5,
  reason: 'No specific data yet for this airport — treated as a genuine toss-up until crowd reports narrow it down.',
};

export const DEFAULT_ORIGIN = 'BLR';

export function getOriginAirport(iata: string | undefined): IndianAirport {
  return ORIGIN_AIRPORTS[(iata ?? DEFAULT_ORIGIN).toUpperCase()] ?? ORIGIN_AIRPORTS[DEFAULT_ORIGIN];
}

export function isKnownOrigin(iata: string): boolean {
  return iata.toUpperCase() in ORIGIN_AIRPORTS;
}

export function findGateRule(airport: IndianAirport, terminal: string, gate: string): GateRule | undefined {
  return airport.gateRules.find((rule) => rule.terminal === terminal && rule.gates.includes(gate));
}

export function getTerminalProfile(airport: IndianAirport, terminal: string): TerminalProfile {
  return airport.terminals[terminal] ?? airport.terminals[airport.defaultTerminal] ?? DEFAULT_TERMINAL_PROFILE;
}

export function findLocality(airport: IndianAirport, id: string): Locality | undefined {
  return airport.localities.find((loc) => loc.id === id);
}
