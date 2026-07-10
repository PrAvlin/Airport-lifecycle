# BLR Airport Lifecycle

A mobile app scoped to **Kempegowda International Airport (BLR), Bangalore**
that walks a passenger through their journey — from arriving at the terminal
to boarding — with live flight status, gate/terminal info, and live traffic
conditions on the drive to the airport, so they can decide when to leave and
how to spend their time once there.

## Structure

```
backend/   Node.js + TypeScript + Express + Socket.IO API. Pulls live BLR
           departures from a public flight-data API and live drive-time
           traffic from a public routing API.
mobile/    Expo (React Native + TypeScript) app consuming that API.
```

## Live data sources

| Data | Source | Free tier | Notes |
|---|---|---|---|
| BLR flight schedule/status/delay/terminal | [AeroDataBox](https://rapidapi.com/aedbx-aedbx/api/aerodatabox) via RapidAPI | ~100 requests/month | Gate is only occasionally returned for BLR; terminal and timing are reliable. |
| Live drive-time traffic to BLR | [TomTom Routing API](https://developer.tomtom.com/routing-api) | 2,500 requests/day | Used from a set of Bangalore locality presets to the airport's coordinates. |

**What's not available from any free API, for any airport:** whether a
specific flight boards via jet bridge or shuttle bus, and live security/
immigration queue lengths. The backend estimates these instead of inventing
fake "live" numbers:
- **Boarding method** is derived deterministically from BLR's real terminal
  layout — T2 (opened 2022) is almost entirely aerobridge-served, T1 mixes
  aerobridge gates with bused remote stands — and is always labeled
  "estimated" in the UI, never presented as confirmed.
- **Security/immigration wait** uses a time-of-day-based typical estimate
  (peak vs. off-peak hours), also labeled as an estimate.

### Demo mode

Both integrations need a free API key that you sign up for yourself (see
below) — this project can't create those accounts on your behalf. Until
`AERODATABOX_API_KEY` is set, the backend runs in **demo mode**: it
generates realistic simulated BLR flights and updates them live so the app
is fully explorable. Every API response is tagged `dataSource: 'live'` or
`'demo'`, and the mobile app shows a **LIVE** / **DEMO DATA** badge so it's
always clear which one you're looking at. The same applies to traffic:
without `TOMTOM_API_KEY`, distance/duration estimates fall back to static
typical values instead of live traffic.

## Getting API keys

1. **AeroDataBox** (flight data): sign up at [rapidapi.com](https://rapidapi.com),
   subscribe to the AeroDataBox API's free "Basic" plan, and copy your
   RapidAPI key.
2. **TomTom** (traffic): sign up at [developer.tomtom.com](https://developer.tomtom.com),
   create an app, and copy the API key.

## Running the backend

```bash
cd backend
npm install
cp .env.example .env   # then fill in your keys (optional — runs in demo mode without them)
npm run dev             # starts on http://localhost:4000
```

Environment variables (all optional — omit to run in demo mode):
- `AERODATABOX_API_KEY` — enables live BLR flight data
- `AERODATABOX_POLL_INTERVAL_MS` — how often to re-poll (default 10 minutes; keep this conservative, free quotas are small)
- `TOMTOM_API_KEY` — enables live traffic data
- `PORT` — defaults to 4000

Endpoints:
- `GET /health` — status + whether live flights/traffic are configured
- `GET /flights` — today's BLR departures (live or demo) + `meta.dataSource`
- `GET /flights/:flightNumber` — a single flight's current state
- `GET /traffic/localities` — preset Bangalore localities
- `GET /traffic/:localityId` — live (or static) drive time from that locality to BLR
- Socket.IO: emit `subscribe`/`unsubscribe` with a flight number; listen for `flight:snapshot` and `flight:update`

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

## Traffic / "leave by" recommendation

On the journey screen, pick a Bangalore locality and the app shows the
current drive time to BLR (live if `TOMTOM_API_KEY` is set) plus a
suggested "leave home by" time, computed from the flight's boarding start
time minus drive time, typical security/immigration wait, and a fixed
terminal buffer.
