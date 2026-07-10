import { Server, Socket } from 'socket.io';
import { getFlightByNumber } from '../data/flights';
import { FlightUpdateEvent } from '../types';

export function registerSocketHandlers(io: Server): void {
  io.on('connection', (socket: Socket) => {
    socket.on('subscribe', (flightNumber: string) => {
      if (typeof flightNumber !== 'string' || !flightNumber.trim()) return;
      const room = flightNumber.toUpperCase();
      socket.join(room);
      const flight = getFlightByNumber(room);
      if (flight) {
        socket.emit('flight:snapshot', { flight });
      }
    });

    socket.on('unsubscribe', (flightNumber: string) => {
      if (typeof flightNumber !== 'string') return;
      socket.leave(flightNumber.toUpperCase());
    });
  });
}

export function broadcastFlightUpdate(io: Server, event: FlightUpdateEvent): void {
  io.to(event.flight.flightNumber).emit('flight:update', event);
}
