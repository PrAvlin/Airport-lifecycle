import { getOriginAirport, isKnownOrigin, ORIGIN_AIRPORTS, OriginAirport } from './airports';
import { getDestinationProfile } from './destinationAirports';
import { boardingInputs, disembarkInputs, estimateAndRegister } from '../services/methodEstimate';
import { estimateBaggageWaitMinutes, estimateSecurityWaitMinutes } from '../services/waitTimeEstimate';
import { ArrivalFlightState, FlightState } from '../types';

const AIRLINES = ['IndiGo', 'Air India', 'Vistara', 'SpiceJet', 'Akasa Air'];
const BOARDING_LEAD_MINUTES = 30;
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
 * Domestic-only, same as the live path.
 */
export function createMockFlight(airport: OriginAirport, overrides: Partial<FlightState> = {}): FlightState {
  const airline = pick(AIRLINES);
  const destination = pick(Object.keys(ORIGIN_AIRPORTS).filter((d) => d !== airport.iata));
  const departureInMinutes = 45 + Math.floor(Math.random() * 120);
  const terminal = pick(Object.keys(airport.terminals));
  const gate = pickGate(airport, terminal);
  const flightNumber = randomFlightNumber(airline);
  const estimatedDeparture = minutesFromNow(departureInMinutes);
  const now = new Date();

  const destinationProfile = getDestinationProfile(destination);
  // Every domestic destination is also one of our own registered airports,
  // so demo mode always has a real terminal/gate map to exercise gate-level
  // deplaning intelligence instead of always TBD.
  const destAirport = isKnownOrigin(destination) ? getOriginAirport(destination) : undefined;
  const arrivalTerminal = destAirport ? pick(Object.keys(destAirport.terminals)) : 'TBD';
  const arrivalGate = destAirport ? pickGate(destAirport, arrivalTerminal) : 'TBD';
  const scheduledArrival = new Date(
    new Date(estimatedDeparture).getTime() + destinationProfile.typicalFlightMinutes * 60_000,
  ).toISOString();

  const id = `${airport.iata}_${flightNumber}_${estimatedDeparture}`;

  // Demo mode has no real aircraft-rotation data to reason from, so quick-turn inference never applies here.
  const boarding = estimateAndRegister(id, 'board', boardingInputs(airport, terminal, gate));

  const disembark = estimateAndRegister(id, 'deplane', disembarkInputs(destination, arrivalTerminal, arrivalGate));

  const flight: FlightState = {
    id,
    flightNumber,
    airline,
    origin: airport.iata,
    destination,
    scheduledDeparture: estimatedDeparture,
    estimatedDeparture,
    status: 'scheduled',
    terminal,
    gate,
    aircraftType: pick(destinationProfile.typicalFlightMinutes >= 150 ? LONG_HAUL_AIRCRAFT : SHORT_HAUL_AIRCRAFT),
    boarding,
    boardingStartTime: minutesFromNow(departureInMinutes - BOARDING_LEAD_MINUTES),
    boardingStartConfidence: 'estimated',
    checkpoints: {
      security: { name: `${terminal} Security Checkpoint`, estimatedWaitMinutes: estimateSecurityWaitMinutes(now) },
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
      baggageWaitMinutes: estimateBaggageWaitMinutes(),
    },
  };

  return { ...flight, ...overrides };
}

const DEMO_COUNTS: Record<string, number> = { BLR: 8, MAA: 7, CJB: 5 };

export function seedDemoFlights(): FlightState[] {
  const flights: FlightState[] = [];
  for (const airport of Object.values(ORIGIN_AIRPORTS)) {
    const count = DEMO_COUNTS[airport.iata] ?? 4;
    for (let i = 0; i < count; i++) {
      flights.push(createMockFlight(airport));
    }
  }
  return flights;
}

/**
 * Demo-mode mirror of createMockFlight for the arrivals side: a flight
 * landing INTO `airport` from some other domestic airport. Reuses the same
 * gate-level intelligence for "how you'll get off the plane" since the
 * destination is always one of our own registered airports here.
 */
export function createMockArrival(airport: OriginAirport, overrides: Partial<ArrivalFlightState> = {}): ArrivalFlightState {
  const airline = pick(AIRLINES);
  const originIata = pick(Object.keys(ORIGIN_AIRPORTS).filter((d) => d !== airport.iata));
  const originAirport = getOriginAirport(originIata);
  const arrivalInMinutes = 20 + Math.floor(Math.random() * 150);
  const terminal = pick(Object.keys(airport.terminals));
  const gate = pickGate(airport, terminal);
  const flightNumber = randomFlightNumber(airline);
  const estimatedArrival = minutesFromNow(arrivalInMinutes);

  const id = `${airport.iata}_ARR_${flightNumber}_${estimatedArrival}`;
  const disembark = estimateAndRegister(id, 'deplane', disembarkInputs(airport.iata, terminal, gate));

  const arrival: ArrivalFlightState = {
    id,
    flightNumber,
    airline,
    origin: originIata,
    originCity: originAirport.city,
    originName: originAirport.name,
    destination: airport.iata,
    scheduledArrival: estimatedArrival,
    estimatedArrival,
    status: 'scheduled',
    terminal,
    gate,
    aircraftType: pick(SHORT_HAUL_AIRCRAFT),
    disembark,
    baggageBelt: undefined,
    baggageWaitMinutes: estimateBaggageWaitMinutes(),
    lastUpdated: new Date().toISOString(),
    dataSource: 'demo',
  };

  return { ...arrival, ...overrides };
}

export function seedDemoArrivals(): ArrivalFlightState[] {
  const arrivals: ArrivalFlightState[] = [];
  for (const airport of Object.values(ORIGIN_AIRPORTS)) {
    const count = DEMO_COUNTS[airport.iata] ?? 4;
    for (let i = 0; i < count; i++) {
      arrivals.push(createMockArrival(airport));
    }
  }
  return arrivals;
}
