import { getOriginAirport, isKnownOrigin, ORIGIN_AIRPORTS, OriginAirport } from './airports';
import { getDestinationProfile } from './destinationAirports';
import { boardingInputs, disembarkInputs, estimateAndRegister } from '../services/methodEstimate';
import {
  estimateArrivalImmigrationWaitMinutes,
  estimateBaggageWaitMinutes,
  estimateImmigrationWaitMinutes,
  estimateSecurityWaitMinutes,
} from '../services/waitTimeEstimate';
import { FlightState } from '../types';

const AIRLINES = ['IndiGo', 'Air India', 'Vistara', 'SpiceJet', 'Akasa Air'];
const ARRIVAL_TERMINALS = ['1', '2', '3'];
const DESTINATIONS = ['BOM', 'DXB', 'SIN', 'LHR', 'MAA', 'HYD', 'DEL', 'PNQ', 'BLR', 'CJB'];
const INTERNATIONAL_DESTINATIONS = new Set(['DXB', 'SIN', 'LHR']);
const SHORT_HAUL_AIRCRAFT = ['Airbus A320', 'Airbus A320neo', 'Airbus A321neo', 'Boeing 737-800', 'ATR 72-600'];
const LONG_HAUL_AIRCRAFT = ['Boeing 777-300ER', 'Airbus A350-900', 'Boeing 787-9 Dreamliner'];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function minutesFromNow(min: number): string {
  return new Date(Date.now() + min * 60_000).toISOString();
}

function randomFlightNumber(airline: string): string {
  const prefixes: Record<string, string> = {
    IndiGo: '6E',
    'Air India': 'AI',
    Vistara: 'UK',
    SpiceJet: 'SG',
    'Akasa Air': 'QP',
  };
  const prefix = prefixes[airline] ?? 'XX';
  return `${prefix}${Math.floor(100 + Math.random() * 900)}`;
}

/** Picks a gate that exists in the airport's gate map most of the time, with occasional TBD/unmapped gates so all confidence paths appear. */
function pickGate(airport: OriginAirport, terminal: string): string {
  const roll = Math.random();
  if (roll < 0.15) return 'TBD';
  const rules = airport.gateRules.filter((r) => r.terminal === terminal);
  if (rules.length === 0 || roll > 0.9) return String(50 + Math.floor(Math.random() * 9));
  const rule = pick(rules);
  return pick(rule.gates);
}

/**
 * Demo-mode flights used only when AERODATABOX_API_KEY is not configured, so
 * the app is still explorable before wiring up the real live data source.
 * Every flight is tagged dataSource: 'demo' and the API surfaces that tag so
 * the UI can show a clear "demo data" indicator rather than pretending it's live.
 */
export function createMockFlight(airport: OriginAirport, overrides: Partial<FlightState> = {}): FlightState {
  const airline = pick(AIRLINES);
  let destination = pick(DESTINATIONS.filter((d) => d !== airport.iata));
  const isInternational = INTERNATIONAL_DESTINATIONS.has(destination);
  const departureInMinutes = 45 + Math.floor(Math.random() * 120);
  const terminal = pick(Object.keys(airport.terminals));
  const gate = pickGate(airport, terminal);
  const flightNumber = randomFlightNumber(airline);
  const estimatedDeparture = minutesFromNow(departureInMinutes);
  const boardingLeadMinutes = isInternational ? 45 : 30;
  const now = new Date();

  const destinationProfile = getDestinationProfile(destination);
  // When the destination happens to be one of our own origin airports
  // (BLR/MAA/CJB), reuse its real terminal/gate map so demo mode also
  // exercises gate-level deplaning intelligence instead of always TBD.
  const destAirport = isKnownOrigin(destination) ? getOriginAirport(destination) : undefined;
  const arrivalTerminal = destAirport ? pick(Object.keys(destAirport.terminals)) : pick(ARRIVAL_TERMINALS);
  const arrivalGate = destAirport ? pickGate(destAirport, arrivalTerminal) : 'TBD';
  const scheduledArrival = new Date(
    new Date(estimatedDeparture).getTime() + destinationProfile.typicalFlightMinutes * 60_000,
  ).toISOString();

  const id = `${airport.iata}_${flightNumber}_${estimatedDeparture}`;

  // Demo mode has no real aircraft-rotation data to reason from, so isQuickTurn is always false here.
  const boarding = estimateAndRegister(
    id,
    'board',
    boardingInputs(airport, terminal, gate),
    false,
    `board:${airport.iata}:${terminal}:${gate}:${flightNumber}`,
  );

  const disembark = estimateAndRegister(
    id,
    'deplane',
    disembarkInputs(destination, arrivalTerminal, arrivalGate),
    false,
    `deplane:${destination}:${arrivalTerminal}:${flightNumber}`,
  );

  const flight: FlightState = {
    id,
    flightNumber,
    airline,
    origin: airport.iata,
    destination,
    isInternational,
    scheduledDeparture: estimatedDeparture,
    estimatedDeparture,
    status: 'scheduled',
    terminal,
    gate,
    aircraftType: pick(destinationProfile.typicalFlightMinutes >= 180 ? LONG_HAUL_AIRCRAFT : SHORT_HAUL_AIRCRAFT),
    boarding,
    boardingStartTime: minutesFromNow(departureInMinutes - boardingLeadMinutes),
    boardingStartConfidence: 'estimated',
    checkpoints: {
      security: { name: `${terminal} Security Checkpoint`, estimatedWaitMinutes: estimateSecurityWaitMinutes(now) },
      ...(isInternational
        ? { immigration: { name: `${terminal} Immigration (Departures)`, estimatedWaitMinutes: estimateImmigrationWaitMinutes(now) } }
        : {}),
    },
    lastUpdated: new Date().toISOString(),
    dataSource: 'demo',
    arrival: {
      airportIata: destination,
      airportName: destinationProfile.name,
      airportCity: destinationProfile.city,
      terminal: arrivalTerminal,
      gate: arrivalGate,
      timezone: destinationProfile.timezone,
      scheduledArrival,
      estimatedArrival: scheduledArrival,
      disembark,
      baggageBelt: undefined,
      immigrationWaitMinutes: isInternational
        ? estimateArrivalImmigrationWaitMinutes(new Date(scheduledArrival), destinationProfile.timezone)
        : undefined,
      baggageWaitMinutes: estimateBaggageWaitMinutes(isInternational),
    },
  };

  return { ...flight, ...overrides };
}

const DEMO_COUNTS: Record<string, number> = { BLR: 8, MAA: 7, CJB: 5 };

export function seedDemoFlights(): FlightState[] {
  const flights: FlightState[] = [];
  for (const airport of Object.values(ORIGIN_AIRPORTS)) {
    const count = DEMO_COUNTS[airport.iata] ?? 6;
    for (let i = 0; i < count; i++) {
      flights.push(createMockFlight(airport));
    }
  }
  return flights;
}
