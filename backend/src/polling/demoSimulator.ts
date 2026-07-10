import { FlightState, FlightStatus, FlightUpdateEvent, FlightUpdateEventType } from '../types';
import { listFlights, patchDemoFlight } from '../data/flightSource';
import { getOriginAirport } from '../data/airports';
import { boardingInputs, estimateAndRegister } from '../services/methodEstimate';

type EventEmitter = (event: FlightUpdateEvent) => void;

function minutesUntil(iso: string): number {
  return Math.round((new Date(iso).getTime() - Date.now()) / 60_000);
}

function emitUpdate(emit: EventEmitter, type: FlightUpdateEventType, flight: FlightState, message: string): void {
  emit({ type, flightId: flight.id, flight, message, timestamp: new Date().toISOString() });
}

/**
 * Demo-only: since real flight data isn't wired up (no AERODATABOX_API_KEY),
 * this randomly nudges the seeded mock flights so the app is still
 * explorable. It never runs once live data is configured.
 */
function tickFlight(flight: FlightState, emit: EventEmitter): void {
  const minutesToDeparture = minutesUntil(flight.scheduledDeparture);
  const roll = Math.random();

  if (flight.status === 'departed' || flight.status === 'cancelled') return;

  if (flight.status === 'scheduled' && roll < 0.06) {
    const airport = getOriginAirport(flight.origin);
    const terminalRules = airport.gateRules.filter((r) => r.terminal === flight.terminal);
    const gatePool = terminalRules.flatMap((r) => r.gates);
    const newGate = gatePool[Math.floor(Math.random() * gatePool.length)];
    if (newGate && newGate !== flight.gate) {
      // The gate drives the boarding-method confidence, so a gate change
      // must recompute the estimate rather than leave the old one stale.
      const boarding = estimateAndRegister(flight.id, 'board', boardingInputs(airport, flight.terminal, newGate));
      const updated = patchDemoFlight(flight.origin, flight.flightNumber, { gate: newGate, boarding });
      if (updated) emitUpdate(emit, 'gate_change', updated, `Gate changed to ${newGate} for ${flight.flightNumber}`);
      return;
    }
  }

  if ((flight.status === 'scheduled' || flight.status === 'delayed') && roll >= 0.06 && roll < 0.15) {
    const delayMinutes = 10 + Math.floor(Math.random() * 20);
    const newDeparture = new Date(new Date(flight.estimatedDeparture).getTime() + delayMinutes * 60_000).toISOString();
    const newBoarding = new Date(new Date(flight.boardingStartTime).getTime() + delayMinutes * 60_000).toISOString();
    const updated = patchDemoFlight(flight.origin, flight.flightNumber, {
      status: 'delayed',
      estimatedDeparture: newDeparture,
      boardingStartTime: newBoarding,
    });
    if (updated) emitUpdate(emit, 'delay', updated, `${flight.flightNumber} delayed by ${delayMinutes} minutes`);
    return;
  }

  const nextStatus = deriveStatus(flight, minutesToDeparture);
  if (nextStatus !== flight.status) {
    const updated = patchDemoFlight(flight.origin, flight.flightNumber, { status: nextStatus });
    if (updated) emitUpdate(emit, 'status_change', updated, describeStatus(flight.flightNumber, nextStatus));
  }
}

function deriveStatus(flight: FlightState, minutesToDeparture: number): FlightStatus {
  if (flight.status === 'cancelled' || flight.status === 'departed') return flight.status;
  const minutesToBoarding = minutesUntil(flight.boardingStartTime);

  if (minutesToDeparture <= 0) return 'departed';
  if (minutesToDeparture <= 5) return 'gate_closed';
  if (minutesToDeparture <= 10) return 'final_call';
  if (minutesToBoarding <= 0) return 'boarding';
  if (flight.status === 'delayed') return 'delayed';
  return 'scheduled';
}

function describeStatus(flightNumber: string, status: FlightStatus): string {
  switch (status) {
    case 'boarding':
      return `${flightNumber} has started boarding`;
    case 'final_call':
      return `Final call for ${flightNumber}`;
    case 'gate_closed':
      return `Gate closed for ${flightNumber}`;
    case 'departed':
      return `${flightNumber} has departed`;
    default:
      return `${flightNumber} status updated to ${status}`;
  }
}

export function startDemoSimulation(emit: EventEmitter, intervalMs = 8000): NodeJS.Timeout {
  return setInterval(() => {
    for (const flight of listFlights()) {
      tickFlight(flight, emit);
    }
  }, intervalMs);
}
