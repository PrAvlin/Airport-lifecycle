# Airport Lifecycle

A mobile app that walks a passenger through their airport journey — from
terminal entry to boarding — with live gate, delay, and boarding-method
(jet bridge vs. shuttle bus) updates so they can decide how to spend their
time at the airport.

## Structure

```
backend/   Node.js + TypeScript + Express + Socket.IO API with a simulated
           live flight/gate/boarding feed (no paid flight-data API required)
mobile/    Expo (React Native + TypeScript) app consuming that feed
```

## How it works

The backend seeds a set of mock flights and runs a simulation loop that
mimics a real airport ops feed: it randomly reassigns gates, flips the
boarding method between jet bridge / shuttle bus / walk-to-aircraft,
introduces delays, and drifts security/immigration wait times. Every change
is broadcast over a Socket.IO room keyed by flight number.

The mobile app subscribes to a flight's room and renders:
- A live status header (on time / delayed / boarding / gate closed / departed)
- Gate, terminal, boarding group, and departure/boarding times
- A boarding-method badge (🌉 jet bridge / 🚌 shuttle bus / 🚶 walk to aircraft)
- A stage-by-stage journey timeline (entry → check-in → security →
  immigration (if international) → gate area → boarding → departed)
- Local push notifications whenever the gate, boarding method, status, or
  delay changes

Because real-time gate/boarding-method data generally isn't available from
free public flight APIs, the backend simulates it. Swapping in a real data
provider later only requires changing what feeds `updateFlight(...)` in
`backend/src/simulation/engine.ts` — the API contract and mobile app stay
the same.

## Running the backend

```bash
cd backend
npm install
npm run dev        # starts on http://localhost:4000
```

Endpoints:
- `GET /health` — health check
- `GET /flights` — list all seeded mock flights
- `GET /flights/:flightNumber` — a single flight's current state
- Socket.IO: emit `subscribe`/`unsubscribe` with a flight number; listen for
  `flight:snapshot` and `flight:update`

## Running the mobile app

```bash
cd mobile
npm install
npm start           # opens Expo dev tools; scan the QR code with Expo Go
```

By default the app points at `http://localhost:4000` (see `apiBaseUrl` in
`mobile/app.json`). When testing on a physical device via Expo Go, change
this to your machine's LAN IP (e.g. `http://192.168.1.20:4000`) so the phone
can reach the backend.

You can also run it in a browser for quick iteration: `npm run web`.

## Notifications

The app requests local notification permissions on launch and fires a
notification whenever it receives a gate change, boarding-method change,
delay, or status transition for the flight currently being tracked.
