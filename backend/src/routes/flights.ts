import { Router } from 'express';
import { getFlightByNumber, getSourceMeta, listFlights, reportBoardingMethod } from '../data/flightSource';
import { isKnownOrigin } from '../data/airports';
import { BoardingMethod } from '../types';

export const flightsRouter = Router();

const VALID_METHODS: BoardingMethod[] = ['jet_bridge', 'shuttle_bus', 'walk_to_aircraft'];

function airportParam(raw: unknown): string | undefined {
  if (typeof raw !== 'string' || !raw.trim()) return undefined;
  return isKnownOrigin(raw) ? raw.toUpperCase() : undefined;
}

flightsRouter.get('/', (req, res) => {
  const airport = airportParam(req.query.airport);
  res.json({ flights: listFlights(airport), meta: getSourceMeta() });
});

flightsRouter.get('/:flightNumber', (req, res) => {
  const airport = airportParam(req.query.airport);
  const flight = getFlightByNumber(req.params.flightNumber, airport);
  if (!flight) {
    res.status(404).json({ error: `Flight ${req.params.flightNumber} not found among today's departures` });
    return;
  }
  res.json({ flight, meta: getSourceMeta() });
});

/**
 * Crowdsourced confirmation: a passenger reports what they actually saw
 * (boarding or deplaning) for this specific flight. Once enough independent
 * reports agree, it's locked in as confirmed and stops being an estimate.
 */
flightsRouter.post('/:flightNumber/boarding-report', (req, res) => {
  const { phase, method, airport } = req.body ?? {};
  if (phase !== 'board' && phase !== 'deplane') {
    res.status(400).json({ error: "phase must be 'board' or 'deplane'" });
    return;
  }
  if (!VALID_METHODS.includes(method)) {
    res.status(400).json({ error: `method must be one of ${VALID_METHODS.join(', ')}` });
    return;
  }

  const flight = reportBoardingMethod(req.params.flightNumber, phase, method, airportParam(airport));
  if (!flight) {
    res.status(404).json({ error: `Flight ${req.params.flightNumber} not found among today's departures` });
    return;
  }
  res.json({ flight });
});
