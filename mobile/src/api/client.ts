import Constants from 'expo-constants';
import { FlightState } from '../types';

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
