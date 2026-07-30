import { config } from '../config';
import { ensureFreshFlights, getActiveAirports } from '../data/flightSource';
import { FlightUpdateEvent } from '../types';

type EventEmitter = (event: FlightUpdateEvent) => void;

// AeroDataBox's free tier rate-limits by requests-per-second, not just a
// monthly cap, so airports are refreshed one at a time with a short gap.
const BETWEEN_AIRPORTS_DELAY_MS = 2000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Keeps already-viewed airports live-updating in the background (so gate
 * changes still push socket notifications) without ever fetching an airport
 * nobody has opened - `ensureFreshFlights` itself is a no-op for anything
 * still within its cache TTL, so this just nudges the same freshness check
 * that the routes already trigger on demand.
 */
async function refreshActiveAirports(emit: EventEmitter): Promise<void> {
  const airports = getActiveAirports();
  for (let i = 0; i < airports.length; i++) {
    await ensureFreshFlights(airports[i], emit);
    if (i < airports.length - 1) {
      await sleep(BETWEEN_AIRPORTS_DELAY_MS);
    }
  }
}

export function startLivePolling(emit: EventEmitter): NodeJS.Timeout {
  return setInterval(() => refreshActiveAirports(emit), config.aerodatabox.pollIntervalMs);
}
