import fs from 'fs';
import path from 'path';
import { BoardingMethod } from '../types';

export type ReportPhase = 'board' | 'deplane';

interface AirportVote {
  method: BoardingMethod;
  at: number; // epoch ms - lets old votes age out (see CONSENSUS_MAX_AGE_MS)
}

/**
 * Raw crowd reports, tracked as one vote per (reporter, flight, phase) - NOT
 * a raw increment-on-every-call counter. Without this, a single caller could
 * hit the report endpoint 3 times in a row and instantly force ANY flight to
 * "confirmed" with a false answer, or single-handedly skew the airport-wide
 * consensus pool - which would make the app's whole "evidence-graduated
 * confidence" pitch fake, since the "evidence" would be fabricable by one
 * actor with zero friction. Resubmitting updates that reporter's own vote
 * (people are allowed to correct themselves) rather than adding a second one.
 *
 * `reporterId` is the caller's IP address (see routes) - not a real identity
 * system, so it's an imperfect proxy (shared IPs/NAT can undercount distinct
 * people, VPNs could work around it), but it converts "anyone can 3x-spam an
 * answer into existence" into "an attacker needs 3 different source IPs",
 * which is the honest, low-effort bar this app can clear without accounts.
 */
const flightReports = new Map<string, Map<string, BoardingMethod>>();
const airportReports = new Map<string, Map<string, AirportVote>>();

// A gate that was shuttle-only two years ago (before a terminal renovation
// added aerobridges, say) shouldn't still be dragging down today's estimate
// forever just because nobody's report ever expires. Votes older than this
// stop counting toward the tally - and get physically pruned (see
// pruneExpiredAirportVotes) so the in-memory map and persisted file don't
// grow unboundedly over the life of a long-running deployment either.
const CONSENSUS_MAX_AGE_MS = 180 * 24 * 60 * 60 * 1000;
const PRUNE_INTERVAL_MS = 60 * 60 * 1000;

function flightKey(flightId: string, phase: ReportPhase): string {
  return `${flightId}:${phase}`;
}

function airportKey(airportIata: string, phase: ReportPhase): string {
  return `${airportIata.toUpperCase()}:${phase}`;
}

function tally(votes: Map<string, BoardingMethod>): Partial<Record<BoardingMethod, number>> {
  const counts: Partial<Record<BoardingMethod, number>> = {};
  for (const method of votes.values()) {
    counts[method] = (counts[method] ?? 0) + 1;
  }
  return counts;
}

function tallyAirportVotes(votes: Map<string, AirportVote>, now: number): Partial<Record<BoardingMethod, number>> {
  const cutoff = now - CONSENSUS_MAX_AGE_MS;
  const counts: Partial<Record<BoardingMethod, number>> = {};
  for (const vote of votes.values()) {
    if (vote.at < cutoff) continue;
    counts[vote.method] = (counts[vote.method] ?? 0) + 1;
  }
  return counts;
}

function pruneExpiredAirportVotes(): void {
  const cutoff = Date.now() - CONSENSUS_MAX_AGE_MS;
  for (const [aKey, votes] of airportReports.entries()) {
    for (const [voterKey, vote] of votes.entries()) {
      if (vote.at < cutoff) votes.delete(voterKey);
    }
    if (votes.size === 0) airportReports.delete(aKey);
  }
}

// Only the airport-level pool is persisted. Per-flight reports are tied to
// one scheduled departure that's irrelevant again within a day or two, but
// the airport pool is explicitly meant to accumulate "across every
// flight/day" (see methodEstimate.ts's consensusInputs) - without surviving
// a restart, that claim would be false every time the process redeploys,
// which for a Node server happens constantly. This is deliberately a flat
// JSON file, not a database: appropriate for this app's current scale, and
// honest about not being built for it yet.
const PERSIST_PATH = path.join(__dirname, '..', '..', '.data', 'airport-reports.json');
const SAVE_DEBOUNCE_MS = 2000;
let saveTimer: NodeJS.Timeout | null = null;

function isAirportVote(value: unknown): value is AirportVote {
  return (
    typeof value === 'object' &&
    value !== null &&
    ('method' in value ? (value as { method: unknown }).method !== undefined : false) &&
    typeof (value as AirportVote).at === 'number'
  );
}

function loadPersisted(): void {
  try {
    const raw = fs.readFileSync(PERSIST_PATH, 'utf-8');
    const parsed = JSON.parse(raw) as Record<string, Record<string, unknown>>;
    for (const [aKey, votes] of Object.entries(parsed)) {
      const validEntries = Object.entries(votes).filter((entry): entry is [string, AirportVote] => isAirportVote(entry[1]));
      airportReports.set(aKey, new Map(validEntries));
    }
    pruneExpiredAirportVotes();
  } catch {
    // No file yet (first run), unreadable, or an older/incompatible format - start empty either way.
  }
}

function persist(): void {
  const serializable: Record<string, Record<string, AirportVote>> = {};
  for (const [aKey, votes] of airportReports.entries()) {
    serializable[aKey] = Object.fromEntries(votes);
  }
  try {
    fs.mkdirSync(path.dirname(PERSIST_PATH), { recursive: true });
    fs.writeFileSync(PERSIST_PATH, JSON.stringify(serializable), 'utf-8');
  } catch (err) {
    console.error('[boardingReports] failed to persist airport consensus:', err instanceof Error ? err.message : err);
  }
}

function schedulePersist(): void {
  if (saveTimer) clearTimeout(saveTimer);
  // unref'd so a short-lived process (a script, a test run) can exit
  // immediately rather than hanging for up to SAVE_DEBOUNCE_MS on a pending
  // write - the real long-running server never intentionally exits, so this
  // doesn't cost it anything, and losing one debounced write on an abrupt
  // exit is an acceptable tradeoff for a best-effort cache like this one.
  saveTimer = setTimeout(persist, SAVE_DEBOUNCE_MS).unref();
}

loadPersisted();
setInterval(() => {
  pruneExpiredAirportVotes();
  schedulePersist();
}, PRUNE_INTERVAL_MS).unref();

export function submitReport(
  flightId: string,
  phase: ReportPhase,
  method: BoardingMethod,
  airportIata: string,
  reporterId: string,
  now: number = Date.now(),
): Partial<Record<BoardingMethod, number>> {
  const fKey = flightKey(flightId, phase);
  const flightVotes = flightReports.get(fKey) ?? new Map<string, BoardingMethod>();
  flightVotes.set(reporterId, method);
  flightReports.set(fKey, flightVotes);

  // 'N/A' means AeroDataBox never published a destination for this flight -
  // tallying it would pollute the cross-flight consensus pool under a bogus
  // airport key that no real query ever matches, so it only gets the
  // per-flight tally above (still enough for that exact flight to lock in).
  if (airportIata && airportIata !== 'N/A') {
    const aKey = airportKey(airportIata, phase);
    const airportVotes = airportReports.get(aKey) ?? new Map<string, AirportVote>();
    // Keyed by reporter+flight (not just reporter) so the same person's
    // honest reports on DIFFERENT flights at this airport each still count -
    // only repeat submissions for the SAME flight collapse into one vote.
    airportVotes.set(`${reporterId}:${flightId}`, { method, at: now });
    airportReports.set(aKey, airportVotes);
    schedulePersist();
  }

  return tally(flightVotes);
}

export function getReportCounts(flightId: string, phase: ReportPhase): Partial<Record<BoardingMethod, number>> {
  const votes = flightReports.get(flightKey(flightId, phase));
  return votes ? tally(votes) : {};
}

export function getAirportReportCounts(
  airportIata: string,
  phase: ReportPhase,
  now: number = Date.now(),
): Partial<Record<BoardingMethod, number>> {
  const votes = airportReports.get(airportKey(airportIata, phase));
  return votes ? tallyAirportVotes(votes, now) : {};
}
