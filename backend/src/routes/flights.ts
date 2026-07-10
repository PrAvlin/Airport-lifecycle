import { Router } from 'express';
import { getFlightByNumber, getSourceMeta, listFlights } from '../data/flightSource';

export const flightsRouter = Router();

flightsRouter.get('/', (_req, res) => {
  res.json({ flights: listFlights(), meta: getSourceMeta() });
});

flightsRouter.get('/:flightNumber', (req, res) => {
  const flight = getFlightByNumber(req.params.flightNumber);
  if (!flight) {
    res.status(404).json({ error: `Flight ${req.params.flightNumber} not found among today's BLR departures` });
    return;
  }
  res.json({ flight, meta: getSourceMeta() });
});
