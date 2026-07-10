import { BoardingMethod, FlightState, FlightStatus, FlightUpdateEvent, FlightUpdateEventType } from '../types';
import { getFlightStore, updateFlight } from '../data/flights';

type EventEmitter = (event: FlightUpdateEvent) => void;

const GATES = ['A1', 'A4', 'A12', 'B3', 'B7', 'C2', 'C9', 'D5'];
const BOARDING_METHODS: BoardingMethod[] = ['jet_bridge', 'shuttle_bus', 'walk_to_aircraft'];

function minutesUntil(iso: string): number {
  return Math.round((new Date(iso).getTime() - Date.now()) / 60_000);
}

function emitUpdate(
  emit: EventEmitter,
  type: FlightUpdateEventType,
  flight: FlightState,
  message: string,
): void {
  emit({
    type,
    flightId: flight.id,
    flight,
    message,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Advances one flight's lifecycle by a small random step each tick, mimicking
 * the kind of last-minute operational changes a real airport feed would push:
 * gate reassignments, boarding-method swaps, delays, and status transitions.
 */
function tickFlight(flight: FlightState, emit: EventEmitter): void {
  const minutesToDeparture = minutesUntil(flight.scheduledDeparture);
  const roll = Math.random();

  if (flight.status === 'departed' || flight.status === 'cancelled') {
    return;
  }

  // Occasionally reassign the gate (only before boarding starts).
  if (flight.status === 'scheduled' && roll < 0.06) {
    const newGate = GATES[Math.floor(Math.random() * GATES.length)];
    if (newGate !== flight.gate) {
      const updated = updateFlight(flight.flightNumber, { gate: newGate });
      if (updated) emitUpdate(emit, 'gate_change', updated, `Gate changed to ${newGate} for ${flight.flightNumber}`);
      return;
    }
  }

  // Occasionally swap boarding method (bridge vs shuttle) before boarding.
  if (flight.status === 'scheduled' && roll >= 0.06 && roll < 0.11) {
    const options = BOARDING_METHODS.filter((m) => m !== flight.boardingMethod);
    const newMethod = options[Math.floor(Math.random() * options.length)];
    const updated = updateFlight(flight.flightNumber, { boardingMethod: newMethod });
    if (updated) {
      const label = newMethod === 'jet_bridge' ? 'jet bridge' : newMethod === 'shuttle_bus' ? 'shuttle bus' : 'walk to aircraft';
      emitUpdate(emit, 'boarding_method_change', updated, `${flight.flightNumber} will now board via ${label}`);
    }
    return;
  }

  // Occasionally introduce a short delay.
  if ((flight.status === 'scheduled' || flight.status === 'delayed') && roll >= 0.11 && roll < 0.15) {
    const delayMinutes = 10 + Math.floor(Math.random() * 20);
    const newDeparture = new Date(new Date(flight.estimatedDeparture).getTime() + delayMinutes * 60_000).toISOString();
    const newBoarding = new Date(new Date(flight.boardingStartTime).getTime() + delayMinutes * 60_000).toISOString();
    const updated = updateFlight(flight.flightNumber, {
      status: 'delayed',
      estimatedDeparture: newDeparture,
      boardingStartTime: newBoarding,
    });
    if (updated) emitUpdate(emit, 'delay', updated, `${flight.flightNumber} delayed by ${delayMinutes} minutes`);
    return;
  }

  // Security/immigration wait times drift slightly each tick.
  if (roll >= 0.15 && roll < 0.25) {
    const security = {
      ...flight.checkpoints.security,
      estimatedWaitMinutes: Math.max(2, flight.checkpoints.security.estimatedWaitMinutes + (Math.random() > 0.5 ? 2 : -2)),
    };
    const updated = updateFlight(flight.flightNumber, { checkpoints: { ...flight.checkpoints, security } });
    if (updated) emitUpdate(emit, 'wait_time_update', updated, `Security wait now ~${security.estimatedWaitMinutes} min`);
    return;
  }

  // Status progression based on time-to-departure.
  const nextStatus = deriveStatus(flight, minutesToDeparture);
  if (nextStatus !== flight.status) {
    const updated = updateFlight(flight.flightNumber, { status: nextStatus });
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

export function startSimulation(emit: EventEmitter, intervalMs = 8000): NodeJS.Timeout {
  return setInterval(() => {
    const flights = Array.from(getFlightStore().values());
    for (const flight of flights) {
      tickFlight(flight, emit);
    }
  }, intervalMs);
}
