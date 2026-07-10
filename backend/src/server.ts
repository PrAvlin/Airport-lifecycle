import cors from 'cors';
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { seedFlights } from './data/flights';
import { flightsRouter } from './routes/flights';
import { startSimulation } from './simulation/engine';
import { broadcastFlightUpdate, registerSocketHandlers } from './sockets';

const PORT = Number(process.env.PORT) || 4000;

const app = express();
app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

app.use('/flights', flightsRouter);

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*' },
});

registerSocketHandlers(io);

const seeded = seedFlights(8);
console.log(`Seeded ${seeded.length} mock flights:`, seeded.map((f) => f.flightNumber).join(', '));

startSimulation((event) => {
  broadcastFlightUpdate(io, event);
  console.log(`[${event.type}] ${event.message}`);
});

httpServer.listen(PORT, () => {
  console.log(`Airport lifecycle backend listening on http://localhost:${PORT}`);
});
