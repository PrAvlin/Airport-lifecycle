# BLR Airport Lifecycle

A mobile app scoped to **Kempegowda International Airport (BLR), Bangalore**
that walks a passenger through their full door-to-door journey — traffic to
the airport, terminal entry, security, boarding, the flight itself, touchdown,
deplaning, immigration & customs, baggage claim, and exit to the arrival
city — with live flight status and live traffic so they can decide when to
leave and how to spend their time along the way.

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
specific flight boards or deplanes via jet bridge vs. shuttle bus, and live
security/immigration/baggage queue lengths.

For the boarding/deplaning method, the backend does **not** just pick one
option and present it as fact — a confidently-stated wrong answer is worse
than an honest "we don't know yet," since it leaves a passenger unprepared
for a bus or a walk across the tarmac. Instead it computes a real confidence
level from three inputs and is upfront about which one it's using:

- **Terminal/airport-layout base rate.** BLR's T2 (opened 2022) is almost
  entirely aerobridge-served; T1 mixes aerobridge gates with bused remote
  stands. Deplaning at the destination uses a small curated profile per
  airport BLR actually flies to (LHR, DXB, SIN, DEL, BOM, HYD, MAA, PNQ),
  with a generic fallback for anything else.
- **Aircraft-rotation signal.** AeroDataBox reports each flight's aircraft
  registration and real scheduled times. If the same airframe that just
  landed at BLR is scheduled to depart again within ~90 minutes, that's a
  real operational signal (not a guess) that it's on a contact/aerobridge
  stand, since airlines route fast turnarounds to bridge gates whenever
  possible — cross-referenced from data already being fetched, at no extra
  API-quota cost (see `direction=Both` in `aerodatabox.ts`).
- **Crowdsourced reports.** Passengers can report what they actually saw
  (`POST /flights/:flightNumber/boarding-report`). Each report shifts the
  estimate immediately; once 3 independent reports agree for that specific
  flight, it locks in as `confirmed`.

These combine into one of three confidence levels, and the app's behavior
changes with it — not just the caption:
- **`confirmed`** (crowd-verified): shows a solid badge.
- **`likely`** (probability ≥ 75%, e.g. T2's base rate alone clears this):
  shows a badge with the probability and the reasoning, plus a report prompt.
- **`uncertain`** (a genuine toss-up, e.g. T1 with no other signal): shows
  **no confident answer at all** — just the reasoning, a practical "come
  prepared for a bus" tip, and the report prompt front and center.

**Security/immigration/baggage wait** uses a time-of-day-based typical
estimate (peak vs. off-peak hours, computed in the destination's local
timezone for arrival-side waits), also always labeled as an estimate.

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
- `GET /flights/:flightNumber` — a single flight's current state (departure + arrival/deplaning info)
- `POST /flights/:flightNumber/boarding-report` — body `{ phase: 'board'|'deplane', method: 'jet_bridge'|'shuttle_bus'|'walk_to_aircraft' }`; submits a passenger's crowdsourced report
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
