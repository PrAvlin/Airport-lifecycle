import { Server, Socket } from 'socket.io';
import { getFlightByNumber } from '../data/flightSource';
import { FlightUpdateEvent } from '../types';

interface SubscribePayload {
  flightNumber: string;
  airport?: string;
}

// A flight number alone isn't unique - the same number can exist out of two
// different origin airports on the same day (see flightSource.ts's storeKey),
// so the room must include the airport too. Otherwise a passenger tracking
// one flight could join the same room as - and receive updates for - an
// unrelated flight that happens to share its number at another airport.
function roomKey(flightNumber: string, airport?: string): string {
  const upperFlight = flightNumber.toUpperCase();
  return airport ? `${airport.toUpperCase()}:${upperFlight}` : upperFlight;
}

function parsePayload(payload: SubscribePayload): { flightNumber?: string; airport?: string } {
  if (!payload || typeof payload.flightNumber !== 'string') return {};
  return { flightNumber: payload.flightNumber, airport: payload.airport };
}

export function registerSocketHandlers(io: Server): void {
  io.on('connection', (socket: Socket) => {
    socket.on('subscribe', (payload: SubscribePayload) => {
      const { flightNumber, airport } = parsePayload(payload);
      if (!flightNumber?.trim()) return;
      socket.join(roomKey(flightNumber, airport));
      const flight = getFlightByNumber(flightNumber, airport);
      if (flight) {
        socket.emit('flight:snapshot', { flight });
      }
    });

    socket.on('unsubscribe', (payload: SubscribePayload) => {
      const { flightNumber, airport } = parsePayload(payload);
      if (!flightNumber) return;
      socket.leave(roomKey(flightNumber, airport));
    });
  });
}

export function broadcastFlightUpdate(io: Server, event: FlightUpdateEvent): void {
  io.to(roomKey(event.flight.flightNumber, event.flight.origin)).emit('flight:update', event);
}
