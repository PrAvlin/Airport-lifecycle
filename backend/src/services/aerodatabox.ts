import { config } from '../config';
import { BLR_AIRPORT, BlrTerminal } from '../data/airport';
import { getDestinationProfile } from '../data/destinationAirports';
import { estimateBoardingMethod, estimateDisembarkMethod } from './boardingHeuristic';
import {
  estimateArrivalImmigrationWaitMinutes,
  estimateBaggageWaitMinutes,
  estimateImmigrationWaitMinutes,
  estimateSecurityWaitMinutes,
} from './waitTimeEstimate';
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
  baggageBelt?: string;
}

interface AeroDataBoxFlight {
  number?: string;
  status?: string;
  airline?: { name?: string };
  aircraft?: { reg?: string };
  departure?: AeroDataBoxMovement;
  arrival?: AeroDataBoxMovement;
  isCargo?: boolean;
}

interface AeroDataBoxResponse {
  departures?: AeroDataBoxFlight[];
  arrivals?: AeroDataBoxFlight[];
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

// A same-airframe arrival-to-departure gap this tight means BLR ground ops
// almost certainly parked it on a contact/aerobridge stand to make the turn.
const QUICK_TURN_MAX_MINUTES = 90;

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

/**
 * Cross-references aircraft registrations between BLR arrivals and
 * departures in the fetched window to find quick turnarounds - a real
 * operational signal (not a guess) that a stand is bridge-served, since fast
 * turns are steered to contact gates whenever possible.
 */
function findQuickTurnRegistrations(arrivals: AeroDataBoxFlight[], departures: AeroDataBoxFlight[]): Set<string> {
  const arrivalTimesByReg = new Map<string, Date[]>();
  for (const flight of arrivals) {
    const reg = flight.aircraft?.reg;
    const landedUtc = flight.arrival?.revisedTime?.utc ?? flight.arrival?.scheduledTime?.utc;
    if (!reg || !landedUtc) continue;
    const list = arrivalTimesByReg.get(reg) ?? [];
    list.push(new Date(landedUtc));
    arrivalTimesByReg.set(reg, list);
  }

  const quickTurnRegs = new Set<string>();
  for (const flight of departures) {
    const reg = flight.aircraft?.reg;
    const depUtc = flight.departure?.revisedTime?.utc ?? flight.departure?.scheduledTime?.utc;
    const landedTimes = reg && arrivalTimesByReg.get(reg);
    if (!reg || !depUtc || !landedTimes) continue;

    const departureTime = new Date(depUtc).getTime();
    const isQuickTurn = landedTimes.some((landed) => {
      const turnMinutes = (departureTime - landed.getTime()) / 60_000;
      return turnMinutes >= 0 && turnMinutes <= QUICK_TURN_MAX_MINUTES;
    });
    if (isQuickTurn) quickTurnRegs.add(reg);
  }

  return quickTurnRegs;
}

function toFlightState(raw: AeroDataBoxFlight, quickTurnRegs: Set<string>): FlightState | null {
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
  const isQuickTurn = !!raw.aircraft?.reg && quickTurnRegs.has(raw.aircraft.reg);

  const destinationProfile = getDestinationProfile(destinationIata);
  const arrivalTerminal = raw.arrival?.terminal ?? 'TBD';
  const arrivalScheduledUtc = raw.arrival?.scheduledTime?.utc ?? estimatedDeparture;
  const arrivalEstimatedUtc = raw.arrival?.revisedTime?.utc ?? arrivalScheduledUtc;

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
    boardingMethod: estimateBoardingMethod(terminal, gate, flightNumber, isQuickTurn),
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
    arrival: {
      airportIata: destinationIata,
      airportName: raw.arrival?.airport?.name ?? destinationProfile.name,
      terminal: arrivalTerminal,
      timezone: destinationProfile.timezone,
      scheduledArrival: arrivalScheduledUtc,
      estimatedArrival: arrivalEstimatedUtc,
      disembarkMethod: estimateDisembarkMethod(destinationIata, arrivalTerminal, flightNumber, isQuickTurn),
      disembarkMethodConfidence: 'estimated',
      baggageBelt: raw.arrival?.baggageBelt,
      immigrationWaitMinutes: isInternational
        ? estimateArrivalImmigrationWaitMinutes(new Date(arrivalEstimatedUtc), destinationProfile.timezone)
        : undefined,
      baggageWaitMinutes: estimateBaggageWaitMinutes(isInternational),
    },
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

  // direction=Both returns arrivals alongside departures in the same call (no
  // extra quota cost), which is what lets us cross-reference aircraft
  // rotations for the quick-turn heuristic below.
  const url =
    `https://${config.aerodatabox.host}/flights/airports/iata/${BLR_AIRPORT.iata}/${from}/${to}` +
    `?withLeg=true&direction=Both&withCancelled=true&withCodeshared=false&withCargo=false&withPrivate=false&withLocation=false`;

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
  const departures = body.departures ?? [];
  const arrivals = body.arrivals ?? [];
  const quickTurnRegs = findQuickTurnRegistrations(arrivals, departures);

  return departures
    .map((flight) => toFlightState(flight, quickTurnRegs))
    .filter((f): f is FlightState => f !== null);
}
