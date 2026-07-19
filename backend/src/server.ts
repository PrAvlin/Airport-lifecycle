import cors from 'cors';
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { config } from './config';
import { seedDemoMode, setBroadcastEmitter } from './data/flightSource';
import { airportsRouter } from './routes/airports';
import { arrivalsRouter } from './routes/arrivals';
import { flightsRouter } from './routes/flights';
import { trafficRouter } from './routes/traffic';
import { startDemoSimulation } from './polling/demoSimulator';
import { startLivePolling } from './polling/livePoller';
import { broadcastFlightUpdate, registerSocketHandlers } from './sockets';

const app = express();
// This app is meant to run behind a Codespaces-forwarded port or an ngrok
// tunnel (see README) - without this, req.ip resolves to the tunnel's own
// address for every request, so every passenger would look like the same
// reporter to the crowd-report dedup/rate-limit (see boardingReports.ts and
// reportRateLimit.ts), silently capping real consensus at ~1 effective vote.
app.set('trust proxy', true);
app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    time: new Date().toISOString(),
    liveFlights: config.aerodatabox.enabled,
    liveTraffic: config.tomtom.enabled,
  });
});

app.use('/airports', airportsRouter);
app.use('/flights', flightsRouter);
app.use('/arrivals', arrivalsRouter);
app.use('/traffic', trafficRouter);

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*' },
});

registerSocketHandlers(io);

const emit = (event: Parameters<typeof broadcastFlightUpdate>[1]) => {
  broadcastFlightUpdate(io, event);
  console.log(`[${event.type}] ${event.message}`);
};
setBroadcastEmitter(emit);

if (config.aerodatabox.enabled) {
  console.log('AERODATABOX_API_KEY found — airports fetch on demand as they are opened (see /airports for the full list).');
  startLivePolling(emit);
} else {
  console.log('AERODATABOX_API_KEY not set — running in DEMO mode with simulated flights.');
  seedDemoMode();
  startDemoSimulation(emit);
}

if (!config.tomtom.enabled) {
  console.log('TOMTOM_API_KEY not set — traffic estimates will use static typical durations.');
}

httpServer.listen(config.port, () => {
  console.log(`Airport lifecycle backend listening on http://localhost:${config.port}`);
});
