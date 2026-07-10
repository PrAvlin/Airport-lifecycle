import { v4 as uuid } from 'uuid';
import { BoardingMethod, FlightState } from '../types';

const AIRLINES = ['IndiGo', 'Air India', 'Vistara', 'SpiceJet', 'Akasa Air'];
const TERMINALS = ['T1', 'T2', 'T3'];
const GATES = ['A1', 'A4', 'A12', 'B3', 'B7', 'C2', 'C9', 'D5'];
const BOARDING_METHODS: BoardingMethod[] = ['jet_bridge', 'shuttle_bus', 'walk_to_aircraft'];
const DESTINATIONS = ['BOM', 'BLR', 'DXB', 'SIN', 'LHR', 'DEL', 'MAA', 'HYD'];

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

export function createMockFlight(overrides: Partial<FlightState> = {}): FlightState {
  const airline = pick(AIRLINES);
  const destination = pick(DESTINATIONS);
  const isInternational = ['DXB', 'SIN', 'LHR'].includes(destination);
  const departureInMinutes = 45 + Math.floor(Math.random() * 120);

  const flight: FlightState = {
    id: uuid(),
    flightNumber: randomFlightNumber(airline),
    airline,
    origin: 'DEL',
    destination,
    isInternational,
    scheduledDeparture: minutesFromNow(departureInMinutes),
    estimatedDeparture: minutesFromNow(departureInMinutes),
    status: 'scheduled',
    terminal: pick(TERMINALS),
    gate: pick(GATES),
    boardingMethod: pick(BOARDING_METHODS),
    boardingGroup: pick(['A', 'B', 'C', '1', '2', '3']),
    boardingStartTime: minutesFromNow(departureInMinutes - 30),
    checkpoints: {
      security: { name: 'Security Checkpoint 2', estimatedWaitMinutes: 5 + Math.floor(Math.random() * 25) },
      ...(isInternational
        ? { immigration: { name: 'Immigration Counter B', estimatedWaitMinutes: 5 + Math.floor(Math.random() * 20) } }
        : {}),
    },
    lastUpdated: new Date().toISOString(),
  };

  return { ...flight, ...overrides };
}

const flightStore = new Map<string, FlightState>();

export function seedFlights(count = 8): FlightState[] {
  const flights: FlightState[] = [];
  for (let i = 0; i < count; i++) {
    const flight = createMockFlight();
    flightStore.set(flight.flightNumber, flight);
    flights.push(flight);
  }
  return flights;
}

export function getFlightByNumber(flightNumber: string): FlightState | undefined {
  return flightStore.get(flightNumber.toUpperCase());
}

export function listFlights(): FlightState[] {
  return Array.from(flightStore.values());
}

export function updateFlight(flightNumber: string, patch: Partial<FlightState>): FlightState | undefined {
  const existing = flightStore.get(flightNumber.toUpperCase());
  if (!existing) return undefined;
  const updated: FlightState = { ...existing, ...patch, lastUpdated: new Date().toISOString() };
  flightStore.set(flightNumber.toUpperCase(), updated);
  return updated;
}

export function getFlightStore() {
  return flightStore;
}
