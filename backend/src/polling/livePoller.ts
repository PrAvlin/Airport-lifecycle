import { config } from '../config';
import { ORIGIN_AIRPORTS } from '../data/airports';
import { fetchLiveDepartures } from '../services/aerodatabox';
import { applyLiveSnapshot, recordFetchError } from '../data/flightSource';
import { FlightUpdateEvent } from '../types';

type EventEmitter = (event: FlightUpdateEvent) => void;

async function pollOnce(emit: EventEmitter): Promise<void> {
  // Polled sequentially, one call per airport per cycle. With three origin
  // airports this triples quota use versus one - keep the poll interval
  // conservative or trim ORIGIN_AIRPORTS if the free tier runs hot.
  for (const airport of Object.values(ORIGIN_AIRPORTS)) {
    try {
      const flights = await fetchLiveDepartures(airport);
      applyLiveSnapshot(airport.iata, flights, emit);
      console.log(`[live-poller] refreshed ${flights.length} ${airport.iata} departures from AeroDataBox`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown AeroDataBox error';
      recordFetchError(message);
      console.error(`[live-poller] ${airport.iata} fetch failed: ${message}`);
    }
  }
}

export function startLivePolling(emit: EventEmitter): NodeJS.Timeout {
  pollOnce(emit);
  return setInterval(() => pollOnce(emit), config.aerodatabox.pollIntervalMs);
}
