import Constants from 'expo-constants';
import { AirportSummary, ArrivalFlightState, BoardingMethod, FlightState, Locality, TrafficEstimate } from '../types';

function resolveApiBaseUrl(): string {
  const fromExtra = Constants.expoConfig?.extra?.apiBaseUrl as string | undefined;
  return fromExtra ?? 'http://localhost:4000';
}

export const API_BASE_URL = resolveApiBaseUrl();

export async function fetchAirports(): Promise<AirportSummary[]> {
  const res = await fetch(`${API_BASE_URL}/airports`);
  if (!res.ok) throw new Error('Failed to load airports');
  const body = await res.json();
  return body.airports as AirportSummary[];
}

export async function fetchFlight(flightNumber: string, airport: string): Promise<FlightState> {
  const res = await fetch(
    `${API_BASE_URL}/flights/${encodeURIComponent(flightNumber)}?airport=${encodeURIComponent(airport)}`,
  );
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Flight ${flightNumber} not found`);
  }
  const body = await res.json();
  return body.flight as FlightState;
}

export async function fetchAllFlights(airport: string): Promise<FlightState[]> {
  const res = await fetch(`${API_BASE_URL}/flights?airport=${encodeURIComponent(airport)}`);
  if (!res.ok) throw new Error('Failed to load flights');
  const body = await res.json();
  return body.flights as FlightState[];
}

export async function fetchAllArrivals(airport: string): Promise<ArrivalFlightState[]> {
  const res = await fetch(`${API_BASE_URL}/arrivals?airport=${encodeURIComponent(airport)}`);
  if (!res.ok) throw new Error('Failed to load arrivals');
  const body = await res.json();
  return body.arrivals as ArrivalFlightState[];
}

export async function fetchArrival(flightNumber: string, airport: string): Promise<ArrivalFlightState> {
  const res = await fetch(
    `${API_BASE_URL}/arrivals/${encodeURIComponent(flightNumber)}?airport=${encodeURIComponent(airport)}`,
  );
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Arrival ${flightNumber} not found`);
  }
  const body = await res.json();
  return body.arrival as ArrivalFlightState;
}

export async function submitDeplaneReport(flightNumber: string, method: BoardingMethod, airport: string): Promise<void> {
  await fetch(`${API_BASE_URL}/arrivals/${encodeURIComponent(flightNumber)}/deplane-report`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ method, airport }),
  });
}

export async function fetchLocalities(airport: string): Promise<Locality[]> {
  const res = await fetch(`${API_BASE_URL}/traffic/${encodeURIComponent(airport)}/localities`);
  if (!res.ok) throw new Error('Failed to load localities');
  const body = await res.json();
  return body.localities as Locality[];
}

export async function fetchTraffic(airport: string, localityId: string): Promise<TrafficEstimate> {
  const res = await fetch(`${API_BASE_URL}/traffic/${encodeURIComponent(airport)}/${encodeURIComponent(localityId)}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Failed to load traffic for ${localityId}`);
  }
  const body = await res.json();
  return body.traffic as TrafficEstimate;
}
