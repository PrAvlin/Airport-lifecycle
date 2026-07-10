import { Router } from 'express';
import { findLocality, getOriginAirport, isKnownOrigin } from '../data/airports';
import { estimateStaticTraffic, fetchLiveTrafficToAirport } from '../services/tomtom';
import { config } from '../config';
import { TrafficEstimate } from '../types';

export const trafficRouter = Router();

const CACHE_TTL_MS = 3 * 60_000;
const cache = new Map<string, { estimate: TrafficEstimate; expiresAt: number }>();

async function getEstimate(airportIata: string, localityId: string): Promise<TrafficEstimate | undefined> {
  const airport = getOriginAirport(airportIata);
  const locality = findLocality(airport, localityId);
  if (!locality) return undefined;

  if (!config.tomtom.enabled) {
    return estimateStaticTraffic(locality, airport);
  }

  const cacheKey = `${airport.iata}:${localityId}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.estimate;
  }

  try {
    const estimate = await fetchLiveTrafficToAirport(locality, airport);
    cache.set(cacheKey, { estimate, expiresAt: Date.now() + CACHE_TTL_MS });
    return estimate;
  } catch (err) {
    console.error(`[traffic] TomTom fetch failed for ${cacheKey}:`, err instanceof Error ? err.message : err);
    return estimateStaticTraffic(locality, airport);
  }
}

trafficRouter.get('/:airport/localities', (req, res) => {
  if (!isKnownOrigin(req.params.airport)) {
    res.status(404).json({ error: `Unknown airport ${req.params.airport}` });
    return;
  }
  const airport = getOriginAirport(req.params.airport);
  res.json({ localities: airport.localities.map(({ id, name }) => ({ id, name })) });
});

trafficRouter.get('/:airport/:localityId', async (req, res) => {
  if (!isKnownOrigin(req.params.airport)) {
    res.status(404).json({ error: `Unknown airport ${req.params.airport}` });
    return;
  }
  const estimate = await getEstimate(req.params.airport, req.params.localityId);
  if (!estimate) {
    res.status(404).json({ error: `Unknown locality ${req.params.localityId}` });
    return;
  }
  res.json({ traffic: estimate });
});
