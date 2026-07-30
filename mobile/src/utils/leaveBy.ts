import { FlightState, TrafficEstimate } from '../types';

const TERMINAL_BUFFER_MINUTES = 20;

export type CheckInStatus = 'not_checked_in' | 'checked_in_with_bags' | 'checked_in_no_bags';

/**
 * Real Indian domestic airline policy cutoffs (IndiGo, Air India - the same
 * pattern holds across major domestic carriers), counted back from
 * departure. These are hard operational deadlines, not courtesy estimates:
 * miss the counter/bag-drop cutoff and you can be denied boarding even if
 * the gate hasn't closed yet.
 * - Airport counter check-in (no web check-in done): closes 60 min before.
 * - Bag drop after web check-in (still have checked baggage): closes 45 min before.
 * - Web checked-in with no checked baggage: only the gate close matters, ~25 min before.
 */
const CUTOFF_MINUTES_BEFORE_DEPARTURE: Record<CheckInStatus, number> = {
  not_checked_in: 60,
  checked_in_with_bags: 45,
  checked_in_no_bags: 25,
};

/**
 * Suggested time to leave, anchored to whichever real deadline actually
 * applies to this passenger's situation - not just a generic "boarding
 * start" estimate, which can be LATER than the real cutoff (e.g. boarding
 * start is modeled as departure-30, but an un-checked-in passenger's real
 * hard deadline is the counter closing at departure-60 - 30 minutes
 * earlier). Defaults to the most conservative assumption (not checked in)
 * when the caller doesn't know the passenger's status, since suggesting
 * they leave too early is a far smaller cost than suggesting too late.
 */
export function computeLeaveByTime(
  flight: FlightState,
  traffic: TrafficEstimate,
  checkInStatus: CheckInStatus = 'not_checked_in',
): Date {
  const securityMinutes = flight.checkpoints.security.estimatedWaitMinutes;
  const totalBufferMinutes = traffic.durationMinutes + securityMinutes + TERMINAL_BUFFER_MINUTES;

  const departureTime = new Date(flight.estimatedDeparture).getTime();
  const requiredAtAirportBy = departureTime - CUTOFF_MINUTES_BEFORE_DEPARTURE[checkInStatus] * 60_000;

  return new Date(requiredAtAirportBy - totalBufferMinutes * 60_000);
}
