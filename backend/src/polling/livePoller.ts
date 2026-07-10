import { config } from '../config';
import { fetchLiveBlrDepartures } from '../services/aerodatabox';
import { applyLiveSnapshot, recordFetchError } from '../data/flightSource';
import { FlightUpdateEvent } from '../types';

type EventEmitter = (event: FlightUpdateEvent) => void;

async function pollOnce(emit: EventEmitter): Promise<void> {
  try {
    const flights = await fetchLiveBlrDepartures();
    applyLiveSnapshot(flights, emit);
    console.log(`[live-poller] refreshed ${flights.length} BLR departures from AeroDataBox`);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown AeroDataBox error';
    recordFetchError(message);
    console.error(`[live-poller] fetch failed: ${message}`);
  }
}

export function startLivePolling(emit: EventEmitter): NodeJS.Timeout {
  pollOnce(emit);
  return setInterval(() => pollOnce(emit), config.aerodatabox.pollIntervalMs);
}
