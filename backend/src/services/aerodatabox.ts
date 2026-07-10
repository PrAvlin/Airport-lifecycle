import { config } from '../config';
import { OriginAirport } from '../data/airports';
import { getDestinationProfile } from '../data/destinationAirports';
import { boardingInputs, disembarkInputs, estimateAndRegister, quickTurnInputs } from './methodEstimate';
import { estimateBaggageWaitMinutes, estimateSecurityWaitMinutes } from './waitTimeEstimate';
import { FlightState, FlightStatus } from '../types';

interface AeroDataBoxTime {
  utc?: string;
  local?: string;
}

interface AeroDataBoxMovement {
  airport?: { icao?: string; iata?: string; name?: string; municipalityName?: string; countryCode?: string };
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
  aircraft?: { reg?: string; model?: string };
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

const BOARDING_LEAD_MINUTES = 30;

// A same-airframe arrival-to-departure gap this tight means the aircraft
// almost certainly stayed on (or very near) the same stand to make the turn.
const QUICK_TURN_MAX_MINUTES = 90;

function normalizeTerminal(airport: OriginAirport, raw: string | undefined): string {
  if (raw) {
    const candidate = raw.startsWith('T') ? raw : `T${raw}`;
    if (candidate in airport.terminals) return candidate;
  }
  return airport.defaultTerminal;
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

interface QuickTurnInfo {
  arrivalGate?: string;
  arrivalTerminal?: string;
}

/**
 * Cross-references aircraft registrations between arrivals and departures in
 * the fetched window to find quick turnarounds, and remembers exactly which
 * gate that aircraft arrived at - a real operational signal (not a guess)
 * for what to expect at departure, since a fast turn almost always reuses
 * the same stand rather than automatically implying an aerobridge.
 */
function findQuickTurns(arrivals: AeroDataBoxFlight[], departures: AeroDataBoxFlight[]): Map<string, QuickTurnInfo> {
  const arrivalsByReg = new Map<string, { time: Date; gate?: string; terminal?: string }[]>();
  for (const flight of arrivals) {
    const reg = flight.aircraft?.reg;
    const landedUtc = flight.arrival?.revisedTime?.utc ?? flight.arrival?.scheduledTime?.utc;
    if (!reg || !landedUtc) continue;
    const list = arrivalsByReg.get(reg) ?? [];
    list.push({ time: new Date(landedUtc), gate: flight.arrival?.gate, terminal: flight.arrival?.terminal });
    arrivalsByReg.set(reg, list);
  }

  const quickTurns = new Map<string, QuickTurnInfo>();
  for (const flight of departures) {
    const reg = flight.aircraft?.reg;
    const depUtc = flight.departure?.revisedTime?.utc ?? flight.departure?.scheduledTime?.utc;
    const landings = reg && arrivalsByReg.get(reg);
    if (!reg || !depUtc || !landings) continue;

    const departureTime = new Date(depUtc).getTime();
    const match = landings.find((landed) => {
      const turnMinutes = (departureTime - landed.time.getTime()) / 60_000;
      return turnMinutes >= 0 && turnMinutes <= QUICK_TURN_MAX_MINUTES;
    });
    if (match) quickTurns.set(reg, { arrivalGate: match.gate, arrivalTerminal: match.terminal });
  }

  return quickTurns;
}

function toFlightState(raw: AeroDataBoxFlight, quickTurns: Map<string, QuickTurnInfo>, airport: OriginAirport): FlightState | null {
  const departure = raw.departure;
  const scheduledUtc = departure?.scheduledTime?.utc;
  if (!departure || !scheduledUtc || raw.isCargo) return null;

  // Domestic-only: any route leaving India is out of scope for this app.
  const isInternational = (raw.arrival?.airport?.countryCode ?? 'IN') !== 'IN';
  if (isInternational) return null;

  const flightNumber = normalizeFlightNumber(raw.number);
  const estimatedDeparture = departure.revisedTime?.utc ?? scheduledUtc;
  const terminal = normalizeTerminal(airport, departure.terminal);
  const gate = departure.gate ?? 'TBD';
  const destinationIata = raw.arrival?.airport?.iata ?? 'N/A';
  const boardingStartTime = new Date(new Date(estimatedDeparture).getTime() - BOARDING_LEAD_MINUTES * 60_000).toISOString();
  const now = new Date();
  const quickTurn = raw.aircraft?.reg ? quickTurns.get(raw.aircraft.reg) : undefined;
  const id = `${airport.iata}_${flightNumber}_${scheduledUtc}`;

  const destinationProfile = getDestinationProfile(destinationIata);
  const arrivalTerminal = raw.arrival?.terminal ?? 'TBD';
  const arrivalGate = raw.arrival?.gate ?? 'TBD';
  const arrivalScheduledUtc = raw.arrival?.scheduledTime?.utc ?? estimatedDeparture;
  const arrivalEstimatedUtc = raw.arrival?.revisedTime?.utc ?? arrivalScheduledUtc;

  // The departure gate is always the best evidence when it's known. Only
  // when it's still TBD do we fall back to "this aircraft just arrived at
  // gate X, so it'll likely depart the same way" for a quick turnaround.
  const boardingEstimateInputs =
    gate === 'TBD' && quickTurn?.arrivalGate
      ? quickTurnInputs(airport, quickTurn.arrivalTerminal ?? 'TBD', quickTurn.arrivalGate) ?? boardingInputs(airport, terminal, gate)
      : boardingInputs(airport, terminal, gate);

  const boarding = estimateAndRegister(id, 'board', boardingEstimateInputs);

  const disembark = estimateAndRegister(id, 'deplane', disembarkInputs(destinationIata, arrivalTerminal, arrivalGate));

  return {
    id,
    flightNumber,
    airline: raw.airline?.name ?? 'Unknown Airline',
    origin: airport.iata,
    destination: destinationIata,
    scheduledDeparture: scheduledUtc,
    estimatedDeparture,
    status: deriveStatus(raw.status, estimatedDeparture),
    terminal,
    gate,
    aircraftType: raw.aircraft?.model,
    boarding,
    boardingStartTime,
    boardingStartConfidence: 'estimated',
    checkpoints: {
      security: { name: `${terminal} Security Checkpoint`, estimatedWaitMinutes: estimateSecurityWaitMinutes(now) },
    },
    lastUpdated: new Date().toISOString(),
    dataSource: 'live',
    arrival: {
      airportIata: destinationIata,
      airportName: raw.arrival?.airport?.name ?? destinationProfile.name,
      airportCity: raw.arrival?.airport?.municipalityName ?? destinationProfile.city,
      terminal: arrivalTerminal,
      gate: arrivalGate,
      timezone: destinationProfile.timezone,
      scheduledArrival: arrivalScheduledUtc,
      estimatedArrival: arrivalEstimatedUtc,
      disembark,
      baggageBelt: raw.arrival?.baggageBelt,
      baggageWaitMinutes: estimateBaggageWaitMinutes(),
    },
  };
}

/**
 * Formats a Date as the no-offset local timestamp AeroDataBox expects (e.g.
 * 2026-07-10T08:00), using the AIRPORT's timezone rather than the server's -
 * the Codespace/host running this process is on UTC, and using its clock
 * components here (instead of converting into the airport's local time)
 * shifted the whole "today's departures" window by +5:30, so the list
 * showed flights that had already departed hours ago instead of upcoming
 * ones.
 */
function toLocalParam(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '00';
  const hour = get('hour') === '24' ? '00' : get('hour');
  return `${get('year')}-${get('month')}-${get('day')}T${hour}:${get('minute')}`;
}

export async function fetchLiveDepartures(airport: OriginAirport): Promise<FlightState[]> {
  if (!config.aerodatabox.enabled) {
    throw new Error('AERODATABOX_API_KEY is not configured');
  }

  const now = new Date();
  const from = toLocalParam(new Date(now.getTime() - config.aerodatabox.windowHoursBack * 60 * 60_000), airport.timezone);
  const to = toLocalParam(new Date(now.getTime() + config.aerodatabox.windowHoursForward * 60 * 60_000), airport.timezone);

  // direction=Both returns arrivals alongside departures in the same call (no
  // extra quota cost), which is what lets us cross-reference aircraft
  // rotations for the quick-turn heuristic below.
  const url =
    `https://${config.aerodatabox.host}/flights/airports/iata/${airport.iata}/${from}/${to}` +
    `?withLeg=true&direction=Both&withCancelled=true&withCodeshared=false&withCargo=false&withPrivate=false&withLocation=false`;

  const res = await fetch(url, {
    headers: {
      'X-RapidAPI-Key': config.aerodatabox.apiKey,
      'X-RapidAPI-Host': config.aerodatabox.host,
    },
  });

  if (!res.ok) {
    throw new Error(`AeroDataBox request failed for ${airport.iata}: ${res.status} ${res.statusText}`);
  }

  const body = (await res.json()) as AeroDataBoxResponse;
  const departures = body.departures ?? [];
  const arrivals = body.arrivals ?? [];
  const quickTurns = findQuickTurns(arrivals, departures);

  return departures
    .map((flight) => toFlightState(flight, quickTurns, airport))
    .filter((f): f is FlightState => f !== null);
}
