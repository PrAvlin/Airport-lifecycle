import { BLR_AIRPORT, BlrTerminal } from './airport';
import { estimateBoardingMethod } from '../services/boardingHeuristic';
import { estimateImmigrationWaitMinutes, estimateSecurityWaitMinutes } from '../services/waitTimeEstimate';
import { FlightState } from '../types';

const AIRLINES = ['IndiGo', 'Air India', 'Vistara', 'SpiceJet', 'Akasa Air'];
const TERMINALS: BlrTerminal[] = ['T1', 'T2'];
const GATES = ['1', '4', '12', '3', '7', '2', '9', '5'];
const DESTINATIONS = ['BOM', 'DXB', 'SIN', 'LHR', 'MAA', 'HYD', 'DEL', 'PNQ'];

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

/**
 * Demo-mode flights used only when AERODATABOX_API_KEY is not configured, so
 * the app is still explorable before wiring up the real live data source.
 * Every flight is tagged dataSource: 'demo' and the API surfaces that tag so
 * the UI can show a clear "demo data" indicator rather than pretending it's live.
 */
export function createMockFlight(overrides: Partial<FlightState> = {}): FlightState {
  const airline = pick(AIRLINES);
  const destination = pick(DESTINATIONS);
  const isInternational = ['DXB', 'SIN', 'LHR'].includes(destination);
  const departureInMinutes = 45 + Math.floor(Math.random() * 120);
  const terminal = pick(TERMINALS);
  const gate = pick(GATES);
  const flightNumber = randomFlightNumber(airline);
  const estimatedDeparture = minutesFromNow(departureInMinutes);
  const boardingLeadMinutes = isInternational ? 45 : 30;
  const now = new Date();

  const flight: FlightState = {
    id: `${flightNumber}_${estimatedDeparture}`,
    flightNumber,
    airline,
    origin: BLR_AIRPORT.iata,
    destination,
    isInternational,
    scheduledDeparture: estimatedDeparture,
    estimatedDeparture,
    status: 'scheduled',
    terminal,
    gate,
    boardingMethod: estimateBoardingMethod(terminal, gate, flightNumber),
    boardingMethodConfidence: 'estimated',
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
  };

  return { ...flight, ...overrides };
}

export function seedDemoFlights(count = 8): FlightState[] {
  const flights: FlightState[] = [];
  for (let i = 0; i < count; i++) {
    flights.push(createMockFlight());
  }
  return flights;
}
