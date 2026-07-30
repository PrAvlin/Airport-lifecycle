import { Router } from 'express';
import { ORIGIN_AIRPORTS } from '../data/airports';

export const airportsRouter = Router();

airportsRouter.get('/', (_req, res) => {
  res.json({
    airports: Object.values(ORIGIN_AIRPORTS).map((a) => ({
      iata: a.iata,
      name: a.name,
      city: a.city,
      terminals: Object.keys(a.terminals),
    })),
  });
});
