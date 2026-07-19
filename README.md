# Airport Lifecycle (Domestic India)

A mobile app covering **24 major Indian domestic airports** (Bengaluru,
Chennai, Coimbatore, Delhi, Mumbai, Hyderabad, Kolkata, Pune, Ahmedabad,
Goa, Kochi, Jaipur, Lucknow, Chandigarh, Patna, Bhubaneswar, Indore,
Varanasi, Guwahati, Raipur, Ranchi, Thiruvananthapuram, Nagpur, Mangalore)
that walks a passenger through their full door-to-door domestic journey —
traffic to the airport, terminal entry, security, boarding, the flight
itself, touchdown, deplaning, baggage claim, and exit to the arrival city —
with live flight status and live traffic so they can decide when to leave
and how to spend their time along the way.

## Structure

```
backend/   Node.js + TypeScript + Express + Socket.IO API. Pulls live
           departures from a public flight-data API and live drive-time
           traffic from a public routing API.
mobile/    Expo (React Native + TypeScript) app consuming that API.
```

## Live data sources

| Data | Source | Free tier | Notes |
|---|---|---|---|
| Flight schedule/status/delay/terminal/gate | [AeroDataBox](https://rapidapi.com/aedbx-aedbx/api/aerodatabox) via RapidAPI | ~100 requests/month | Fetched **on demand** per airport (see below), not on a fixed schedule. |
| Live drive-time traffic to each airport | [TomTom Routing API](https://developer.tomtom.com/routing-api) | 2,500 requests/day | Used from per-city locality presets to each airport's coordinates. |

### Why on-demand fetching, not background polling

AeroDataBox's free tier is only ~100 requests/month total. Polling a fixed
list of airports on a timer doesn't scale — even 3 airports on a 10-minute
loop can trip rate limits. So instead, an airport is only fetched from
AeroDataBox the moment someone actually opens it in the app
(`ensureFreshFlights` in `backend/src/data/flightSource.ts`), cached for 10
minutes. A lightweight background refresher then keeps *only* airports
that have actually been viewed recently up to date (`getActiveAirports`),
so quota is spent on real usage, not idle coverage of all 24 airports at
once. This is what makes supporting this many airports possible at all on
the free plan.

**What's not available from any free API, for any airport:** whether a
specific flight boards or deplanes via aerobridge vs. shuttle bus (this
simply isn't a field AeroDataBox or any other free source publishes, live
or historical), and live security/baggage queue lengths.

For the boarding/deplaning method, the backend does **not** just pick one
option and present it as fact — a confidently-stated wrong answer is worse
than an honest "we don't know yet," since it leaves a passenger unprepared
for a bus. Instead it computes a real confidence level from these inputs,
in priority order:

1. **Gate-level knowledge (strongest signal).** The physical layout gives
   it away: a ground-level gate cannot have an aerobridge, while an
   upper-level gate almost always does. Real, curated gate maps exist for
   BLR and BOM so far (`backend/src/data/airports.ts`) — e.g. BLR T1 gates
   1–2/12–18/28–43 are upper-level aerobridge gates while 3–9/19–25 are
   ground-level bus gates. When the gate is known, this replaces the
   terminal-wide average at ~0.9–0.95 probability, for **both** the
   departing flight boarding there and any arriving flight deplaning there.
2. **"Same as its own arrival" for quick turnarounds.** If a flight's own
   departure gate isn't published yet, but AeroDataBox shows the *same
   aircraft* landed at this airport and is scheduled out again within ~90
   minutes, the real signal is that it almost always reuses the same
   stand — so it inherits whatever method that arrival gate actually used
   (aerobridge or shuttle), not a blanket assumption that fast turnarounds
   always mean aerobridge.
3. **Airport-level crowd consensus.** Once at least 5 passenger reports
   have accumulated for a given airport + phase (boarding or deplaning),
   "most of the last N reports here said shuttle" becomes a real signal in
   its own right — even for airports with no curated gate/terminal data at
   all — and it outranks the generic terminal-wide base rate, though a
   matched gate rule still wins over it.
4. **Terminal/airport-layout base rate** (when none of the above apply).
   Every supported airport has a terminal-wide estimate — for MAA
   specifically, this is a real published fact (T1 domestic has 9 gates:
   only 3 upper-level/aerobridge, 6 ground-level/bus) rather than a guess,
   even though the exact gate numbers aren't public.
5. **Crowdsourced reports on this exact flight.** Passengers can report
   what they actually saw (`POST /flights/:flightNumber/boarding-report`
   or `POST /arrivals/:flightNumber/deplane-report`). Each report shifts
   the estimate immediately; once 3 independent reports agree for that
   specific flight, it locks in as `confirmed` — and also adds to that
   airport's crowd-consensus pool above.

   Because this is the one place an unauthenticated caller can change what
   every other user sees, reports are deduplicated per (reporter, flight,
   phase) rather than raw-counted — otherwise a single caller could hit the
   endpoint 3 times and force *any* flight to `confirmed` with a false
   answer. The reporter identity is the caller's IP address (an imperfect,
   account-free proxy — see `backend/src/services/boardingReports.ts`),
   resolved via `app.set('trust proxy', 1)` in `server.ts` so it reflects
   the real client behind the one reverse-proxy hop this app expects
   (Codespaces/ngrok) rather than either the tunnel's own address or a
   value an attacker could spoof by hand (a plain `trust proxy: true` would
   trust an attacker-supplied header, silently defeating this). Report
   endpoints are additionally rate-limited to 10 requests/minute per IP
   (`backend/src/middleware/reportRateLimit.ts`). The airport-level
   consensus pool is persisted to a flat JSON file
   (`backend/.data/airport-reports.json`) so it survives a server
   restart/redeploy — it's explicitly meant to accumulate across days, so an
   in-memory-only version would quietly reset that promise every deploy.
   Individual votes age out of the tally after 180 days (and are pruned
   from disk on an hourly sweep), so a stale report from before a terminal
   renovation doesn't outvote current reality forever.

These combine into one of three confidence levels, and the app's behavior
changes with it — not just the caption. In every case the estimate commits
to a single method (aerobridge **or** shuttle bus, never "could be
either") — the confidence level only changes how much weight to put on it:
- **`confirmed`** (crowd-verified): shows a solid badge.
- **`likely`** (probability ≥ 75%): shows a badge with the probability and
  the reasoning, plus a report prompt.
- **`uncertain`** (a genuine toss-up, probability < 75%): still shows the
  best-guess badge, but framed honestly as a low-confidence guess, plus
  the reasoning, a practical "come prepared for either" tip, and the
  report prompt front and center.

**Security/baggage wait** uses a time-of-day-based typical estimate (peak
vs. off-peak hours), also always labeled as an estimate.

### Demo mode

Both integrations need a free API key that you sign up for yourself (see
below) — this project can't create those accounts on your behalf. Until
`AERODATABOX_API_KEY` is set, the backend runs in **demo mode**: it
generates realistic simulated flights for all 24 airports and updates them
live so the app is fully explorable. Every API response is tagged
`dataSource: 'live'` or `'demo'`, and the mobile app shows a **LIVE** /
**DEMO DATA** badge so it's always clear which one you're looking at. The
same applies to traffic: without `TOMTOM_API_KEY`, distance/duration
estimates fall back to static typical values instead of live traffic.

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
- `AERODATABOX_API_KEY` — enables live flight data
- `AERODATABOX_POLL_INTERVAL_MS` — how often the background refresher re-checks already-viewed airports (default 10 minutes)
- `TOMTOM_API_KEY` — enables live traffic data
- `PORT` — defaults to 4000

Endpoints:
- `GET /health` — status + whether live flights/traffic are configured
- `GET /airports` — all 24 supported domestic airports
- `GET /flights?airport=DEL` — today's departures for that airport (live or demo) + `meta.dataSource`; live requests trigger an on-demand fetch if the cache is stale
- `GET /flights/:flightNumber?airport=DEL` — a single flight's current state (departure + arrival/deplaning info)
- `POST /flights/:flightNumber/boarding-report` — body `{ phase: 'board'|'deplane', method: 'aerobridge'|'shuttle_bus', airport?: 'DEL' }`; submits a passenger's crowdsourced report
- `GET /arrivals?airport=DEL` — today's arrivals INTO that airport (live or demo) + `meta.dataSource`; shares the same on-demand fetch as `/flights` (one AeroDataBox call covers both directions)
- `GET /arrivals/:flightNumber?airport=DEL` — a single inbound flight's current state and disembark-method estimate
- `POST /arrivals/:flightNumber/deplane-report` — body `{ method: 'aerobridge'|'shuttle_bus', airport?: 'DEL' }`; submits a passenger's crowdsourced report for a flight landing at that airport
- `GET /traffic/:airport/localities` — preset localities for that city
- `GET /traffic/:airport/:localityId` — live (or static) drive time from that locality to the airport
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

On the journey screen, pick a locality near your selected airport and the
app shows the current drive time (live if `TOMTOM_API_KEY` is set) plus a
suggested "leave home by" time, computed from the flight's boarding start
time minus drive time, typical security wait, and a fixed terminal buffer.
