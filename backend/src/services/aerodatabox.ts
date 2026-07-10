import { config } from '../config';
import { BLR_AIRPORT, BlrTerminal } from '../data/airport';
import { estimateBoardingMethod } from './boardingHeuristic';
import { estimateImmigrationWaitMinutes, estimateSecurityWaitMinutes } from './waitTimeEstimate';
import { FlightState, FlightStatus } from '../types';

interface AeroDataBoxTime {
  utc?: string;
  local?: string;
}

interface AeroDataBoxMovement {
  airport?: { icao?: string; iata?: string; name?: string; countryCode?: string };
  scheduledTime?: AeroDataBoxTime;
  revisedTime?: AeroDataBoxTime;
  terminal?: string;
  gate?: string;
}

interface AeroDataBoxFlight {
  number?: string;
  status?: string;
  airline?: { name?: string };
  departure?: AeroDataBoxMovement;
  arrival?: AeroDataBoxMovement;
  isCargo?: boolean;
}

interface AeroDataBoxResponse {
  departures?: AeroDataBoxFlight[];
}

const STATUS_MAP: Record<string, FlightStatus> = {
  Unknown: 'scheduled',
  Expected: 'scheduled',
  CheckIn: 'scheduled',
  Delayed: 'delayed',
  Boarding: 'boarding',
  GateClosed: 'gate_closed',
  Departed: 'departed',
  EnRoute: 'departed',
  Arrived: 'departed',
  Approaching: 'departed',
  Diverted: 'departed',
  Canceled: 'cancelled',
  CanceledUncertain: 'cancelled',
  Deleted: 'cancelled',
  CanceledDataSourceOutage: 'cancelled',
};

function normalizeTerminal(raw: string | undefined): BlrTerminal {
  if (raw && raw.includes('2')) return 'T2';
  return 'T1';
}

function normalizeFlightNumber(raw: string | undefined): string {
  return (raw ?? 'UNKNOWN').replace(/\s+/g, '').toUpperCase();
}

function deriveStatus(raw: string | undefined, estimatedDeparture: string): FlightStatus {
  const mapped = raw ? STATUS_MAP[raw] : undefined;
  if (mapped && mapped !== 'scheduled') return mapped;

  const minutesToDeparture = Math.round((new Date(estimatedDeparture).getTime() - Date.now()) / 60_000);
  if (minutesToDeparture <= 5 && minutesToDeparture > -60) return 'gate_closed';
  if (minutesToDeparture <= 10) return 'final_call';
  return mapped ?? 'scheduled';
}

function toFlightState(raw: AeroDataBoxFlight): FlightState | null {
  const departure = raw.departure;
  const scheduledUtc = departure?.scheduledTime?.utc;
  if (!departure || !scheduledUtc || raw.isCargo) return null;

  const flightNumber = normalizeFlightNumber(raw.number);
  const estimatedDeparture = departure.revisedTime?.utc ?? scheduledUtc;
  const terminal = normalizeTerminal(departure.terminal);
  const gate = departure.gate ?? 'TBD';
  const destinationIata = raw.arrival?.airport?.iata ?? 'N/A';
  const isInternational = (raw.arrival?.airport?.countryCode ?? 'IN') !== 'IN';
  const boardingLeadMinutes = isInternational ? 45 : 30;
  const boardingStartTime = new Date(new Date(estimatedDeparture).getTime() - boardingLeadMinutes * 60_000).toISOString();
  const now = new Date();

  return {
    id: `${flightNumber}_${scheduledUtc}`,
    flightNumber,
    airline: raw.airline?.name ?? 'Unknown Airline',
    origin: BLR_AIRPORT.iata,
    destination: destinationIata,
    isInternational,
    scheduledDeparture: scheduledUtc,
    estimatedDeparture,
    status: deriveStatus(raw.status, estimatedDeparture),
    terminal,
    gate,
    boardingMethod: estimateBoardingMethod(terminal, gate, flightNumber),
    boardingMethodConfidence: 'estimated',
    boardingStartTime,
    boardingStartConfidence: 'estimated',
    checkpoints: {
      security: { name: `${terminal} Security Checkpoint`, estimatedWaitMinutes: estimateSecurityWaitMinutes(now) },
      ...(isInternational
        ? { immigration: { name: `${terminal} Immigration (Departures)`, estimatedWaitMinutes: estimateImmigrationWaitMinutes(now) } }
        : {}),
    },
    lastUpdated: new Date().toISOString(),
    dataSource: 'live',
  };
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** Formats a Date as the local (no-offset) timestamp AeroDataBox expects, e.g. 2026-07-10T08:00 */
function toLocalParam(date: Date): string {
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}T${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}`;
}

export async function fetchLiveBlrDepartures(): Promise<FlightState[]> {
  if (!config.aerodatabox.enabled) {
    throw new Error('AERODATABOX_API_KEY is not configured');
  }

  const now = new Date();
  const from = toLocalParam(new Date(now.getTime() - config.aerodatabox.windowHoursBack * 60 * 60_000));
  const to = toLocalParam(new Date(now.getTime() + config.aerodatabox.windowHoursForward * 60 * 60_000));

  const url =
    `https://${config.aerodatabox.host}/flights/airports/iata/${BLR_AIRPORT.iata}/${from}/${to}` +
    `?withLeg=true&direction=Departure&withCancelled=true&withCodeshared=false&withCargo=false&withPrivate=false&withLocation=false`;

  const res = await fetch(url, {
    headers: {
      'X-RapidAPI-Key': config.aerodatabox.apiKey,
      'X-RapidAPI-Host': config.aerodatabox.host,
    },
  });

  if (!res.ok) {
    throw new Error(`AeroDataBox request failed: ${res.status} ${res.statusText}`);
  }

  const body = (await res.json()) as AeroDataBoxResponse;
  const flights = (body.departures ?? [])
    .map(toFlightState)
    .filter((f): f is FlightState => f !== null);

  return flights;
}
