import { Router } from 'express';
import { getFlightByNumber, listFlights } from '../data/flights';

export const flightsRouter = Router();

flightsRouter.get('/', (_req, res) => {
  res.json({ flights: listFlights() });
});

flightsRouter.get('/:flightNumber', (req, res) => {
  const flight = getFlightByNumber(req.params.flightNumber);
  if (!flight) {
    res.status(404).json({ error: `Flight ${req.params.flightNumber} not found` });
    return;
  }
  res.json({ flight });
});
