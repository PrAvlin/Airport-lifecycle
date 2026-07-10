import { Router } from 'express';
import { ensureFreshFlights, getArrivalByNumber, getSourceMeta, listArrivals, reportArrivalMethod } from '../data/flightSource';
import { isKnownOrigin } from '../data/airports';
import { BoardingMethod } from '../types';

export const arrivalsRouter = Router();

const VALID_METHODS: BoardingMethod[] = ['aerobridge', 'shuttle_bus'];

function airportParam(raw: unknown): string | undefined {
  if (typeof raw !== 'string' || !raw.trim()) return undefined;
  return isKnownOrigin(raw) ? raw.toUpperCase() : undefined;
}

arrivalsRouter.get('/', async (req, res) => {
  const airport = airportParam(req.query.airport);
  if (airport) await ensureFreshFlights(airport);
  res.json({ arrivals: listArrivals(airport), meta: getSourceMeta() });
});

arrivalsRouter.get('/:flightNumber', async (req, res) => {
  const airport = airportParam(req.query.airport);
  if (airport) await ensureFreshFlights(airport);
  const arrival = getArrivalByNumber(req.params.flightNumber, airport);
  if (!arrival) {
    res.status(404).json({ error: `Flight ${req.params.flightNumber} not found among today's arrivals` });
    return;
  }
  res.json({ arrival, meta: getSourceMeta() });
});

/**
 * Crowdsourced confirmation for the arrivals side: a passenger reports what
 * they actually saw deplaning. Feeds the same per-airport consensus pool as
 * reports made from the departures side (see methodEstimate.ts).
 */
arrivalsRouter.post('/:flightNumber/deplane-report', (req, res) => {
  const { method, airport } = req.body ?? {};
  if (!VALID_METHODS.includes(method)) {
    res.status(400).json({ error: `method must be one of ${VALID_METHODS.join(', ')}` });
    return;
  }

  const arrival = reportArrivalMethod(req.params.flightNumber, method, airportParam(airport));
  if (!arrival) {
    res.status(404).json({ error: `Flight ${req.params.flightNumber} not found among today's arrivals` });
    return;
  }
  res.json({ arrival });
});
