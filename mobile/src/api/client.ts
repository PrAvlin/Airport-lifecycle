import Constants from 'expo-constants';
import { FlightState, Locality, TrafficEstimate } from '../types';

function resolveApiBaseUrl(): string {
  const fromExtra = Constants.expoConfig?.extra?.apiBaseUrl as string | undefined;
  return fromExtra ?? 'http://localhost:4000';
}

export const API_BASE_URL = resolveApiBaseUrl();

export async function fetchFlight(flightNumber: string): Promise<FlightState> {
  const res = await fetch(`${API_BASE_URL}/flights/${encodeURIComponent(flightNumber)}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Flight ${flightNumber} not found`);
  }
  const body = await res.json();
  return body.flight as FlightState;
}

export async function fetchAllFlights(): Promise<FlightState[]> {
  const res = await fetch(`${API_BASE_URL}/flights`);
  if (!res.ok) throw new Error('Failed to load flights');
  const body = await res.json();
  return body.flights as FlightState[];
}

export async function fetchLocalities(): Promise<Locality[]> {
  const res = await fetch(`${API_BASE_URL}/traffic/localities`);
  if (!res.ok) throw new Error('Failed to load localities');
  const body = await res.json();
  return body.localities as Locality[];
}

export async function fetchTraffic(localityId: string): Promise<TrafficEstimate> {
  const res = await fetch(`${API_BASE_URL}/traffic/${encodeURIComponent(localityId)}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Failed to load traffic for ${localityId}`);
  }
  const body = await res.json();
  return body.traffic as TrafficEstimate;
}
