import { config } from '../config';
import { BLR_AIRPORT } from '../data/airport';
import { Locality } from '../data/localities';
import { TrafficEstimate } from '../types';

interface TomTomRouteSummary {
  travelTimeInSeconds: number;
  noTrafficTravelTimeInSeconds?: number;
  lengthInMeters: number;
}

interface TomTomResponse {
  routes?: { summary: TomTomRouteSummary }[];
}

export async function fetchLiveTrafficToAirport(locality: Locality): Promise<TrafficEstimate> {
  if (!config.tomtom.enabled) {
    throw new Error('TOMTOM_API_KEY is not configured');
  }

  const origin = `${locality.latitude},${locality.longitude}`;
  const destination = `${BLR_AIRPORT.latitude},${BLR_AIRPORT.longitude}`;
  const url =
    `https://api.tomtom.com/routing/1/calculateRoute/${origin}:${destination}/json` +
    `?key=${config.tomtom.apiKey}&traffic=true&travelMode=car&computeTravelTimeFor=all`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`TomTom request failed: ${res.status} ${res.statusText}`);
  }

  const body = (await res.json()) as TomTomResponse;
  const summary = body.routes?.[0]?.summary;
  if (!summary) {
    throw new Error('TomTom response had no route summary');
  }

  const durationMinutes = Math.round(summary.travelTimeInSeconds / 60);
  const typicalDurationMinutes = Math.round((summary.noTrafficTravelTimeInSeconds ?? summary.travelTimeInSeconds) / 60);

  return {
    localityId: locality.id,
    localityName: locality.name,
    distanceKm: Math.round((summary.lengthInMeters / 1000) * 10) / 10,
    durationMinutes,
    typicalDurationMinutes,
    delayMinutes: Math.max(0, durationMinutes - typicalDurationMinutes),
    dataSource: 'live',
  };
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function estimateStaticTraffic(locality: Locality): TrafficEstimate {
  const distanceKm = haversineKm(locality.latitude, locality.longitude, BLR_AIRPORT.latitude, BLR_AIRPORT.longitude);
  return {
    localityId: locality.id,
    localityName: locality.name,
    distanceKm: Math.round(distanceKm * 10) / 10,
    durationMinutes: locality.typicalMinutesNoTraffic,
    typicalDurationMinutes: locality.typicalMinutesNoTraffic,
    delayMinutes: 0,
    dataSource: 'demo',
  };
}
