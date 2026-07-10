import cors from 'cors';
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { config } from './config';
import { seedDemoMode, setBroadcastEmitter } from './data/flightSource';
import { airportsRouter } from './routes/airports';
import { flightsRouter } from './routes/flights';
import { trafficRouter } from './routes/traffic';
import { startDemoSimulation } from './polling/demoSimulator';
import { startLivePolling } from './polling/livePoller';
import { broadcastFlightUpdate, registerSocketHandlers } from './sockets';

const app = express();
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
  console.log('AERODATABOX_API_KEY found — polling live BLR/MAA/CJB departures.');
  startLivePolling(emit);
} else {
  console.log('AERODATABOX_API_KEY not set — running in DEMO mode with simulated BLR/MAA/CJB flights.');
  seedDemoMode();
  startDemoSimulation(emit);
}

if (!config.tomtom.enabled) {
  console.log('TOMTOM_API_KEY not set — traffic estimates will use static typical durations.');
}

httpServer.listen(config.port, () => {
  console.log(`Airport lifecycle backend (BLR·MAA·CJB) listening on http://localhost:${config.port}`);
});
