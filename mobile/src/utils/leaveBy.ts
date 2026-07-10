import { FlightState, TrafficEstimate } from '../types';

const TERMINAL_BUFFER_MINUTES = 20;

/** Suggested time to leave for a driveTime+security-wait-aware "leave by" recommendation. */
export function computeLeaveByTime(flight: FlightState, traffic: TrafficEstimate): Date {
  const securityMinutes = flight.checkpoints.security.estimatedWaitMinutes;
  const immigrationMinutes = flight.checkpoints.immigration?.estimatedWaitMinutes ?? 0;
  const totalBufferMinutes = traffic.durationMinutes + securityMinutes + immigrationMinutes + TERMINAL_BUFFER_MINUTES;

  const boardingStart = new Date(flight.boardingStartTime).getTime();
  return new Date(boardingStart - totalBufferMinutes * 60_000);
}
