import { Router } from 'express';
import { BLR_LOCALITIES, findLocality } from '../data/localities';
import { estimateStaticTraffic, fetchLiveTrafficToAirport } from '../services/tomtom';
import { config } from '../config';
import { TrafficEstimate } from '../types';

export const trafficRouter = Router();

const CACHE_TTL_MS = 3 * 60_000;
const cache = new Map<string, { estimate: TrafficEstimate; expiresAt: number }>();

async function getEstimate(localityId: string): Promise<TrafficEstimate | undefined> {
  const locality = findLocality(localityId);
  if (!locality) return undefined;

  if (!config.tomtom.enabled) {
    return estimateStaticTraffic(locality);
  }

  const cached = cache.get(localityId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.estimate;
  }

  try {
    const estimate = await fetchLiveTrafficToAirport(locality);
    cache.set(localityId, { estimate, expiresAt: Date.now() + CACHE_TTL_MS });
    return estimate;
  } catch (err) {
    console.error(`[traffic] TomTom fetch failed for ${localityId}:`, err instanceof Error ? err.message : err);
    return estimateStaticTraffic(locality);
  }
}

trafficRouter.get('/localities', (_req, res) => {
  res.json({ localities: BLR_LOCALITIES.map(({ id, name }) => ({ id, name })) });
});

trafficRouter.get('/:localityId', async (req, res) => {
  const estimate = await getEstimate(req.params.localityId);
  if (!estimate) {
    res.status(404).json({ error: `Unknown locality ${req.params.localityId}` });
    return;
  }
  res.json({ traffic: estimate });
});
