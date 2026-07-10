import { config } from '../config';
import { ORIGIN_AIRPORTS } from '../data/airports';
import { fetchLiveDepartures } from '../services/aerodatabox';
import { applyLiveSnapshot, recordFetchError } from '../data/flightSource';
import { FlightUpdateEvent } from '../types';

type EventEmitter = (event: FlightUpdateEvent) => void;

// AeroDataBox's free tier rate-limits by requests-per-second, not just a
// monthly cap. Firing all airport requests back-to-back tripped 429s, so
// each one now waits its turn.
const BETWEEN_AIRPORTS_DELAY_MS = 2000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function pollOnce(emit: EventEmitter): Promise<void> {
  // Polled sequentially, one call per airport per cycle, spaced out to
  // respect the per-second rate limit. With three origin airports this
  // triples quota use versus one - keep the poll interval conservative or
  // trim ORIGIN_AIRPORTS if the free tier runs hot.
  const airports = Object.values(ORIGIN_AIRPORTS);
  for (let i = 0; i < airports.length; i++) {
    const airport = airports[i];
    try {
      const flights = await fetchLiveDepartures(airport);
      applyLiveSnapshot(airport.iata, flights, emit);
      console.log(`[live-poller] refreshed ${flights.length} ${airport.iata} departures from AeroDataBox`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown AeroDataBox error';
      recordFetchError(message);
      console.error(`[live-poller] ${airport.iata} fetch failed: ${message}`);
    }
    if (i < airports.length - 1) {
      await sleep(BETWEEN_AIRPORTS_DELAY_MS);
    }
  }
}

export function startLivePolling(emit: EventEmitter): NodeJS.Timeout {
  pollOnce(emit);
  return setInterval(() => pollOnce(emit), config.aerodatabox.pollIntervalMs);
}
