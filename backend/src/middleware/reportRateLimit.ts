import { Request, Response, NextFunction } from 'express';

/**
 * A crowd-report endpoint is the one place in this API that lets an
 * unauthenticated caller change what every other user sees (the confidence
 * badge). Even with per-reporter dedup (see boardingReports.ts) capping how
 * much any one caller's vote counts, an unbounded request rate is still free
 * cost to inflict on the server and free cover for probing/abuse. This is a
 * deliberately simple fixed-window limiter (no Redis, no extra dependency) -
 * appropriate for a single-process app; it resets on restart and won't scale
 * across multiple instances, which is fine at this app's current size.
 */
const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 10;

const hits = new Map<string, { count: number; windowStart: number }>();

// Every distinct caller ever seen would otherwise leave a permanent entry
// here for the life of the process - a slow but real memory leak on a
// long-running server. Sweep out anything whose window has already lapsed.
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of hits.entries()) {
    if (now - entry.windowStart >= WINDOW_MS) hits.delete(key);
  }
}, WINDOW_MS).unref();

interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds?: number;
}

/** The actual fixed-window decision, kept separate from the Express plumbing so it's directly unit-testable with an injected clock. */
export function checkRateLimit(key: string, now: number = Date.now()): RateLimitResult {
  const entry = hits.get(key);

  if (!entry || now - entry.windowStart >= WINDOW_MS) {
    hits.set(key, { count: 1, windowStart: now });
    return { allowed: true };
  }

  if (entry.count >= MAX_REQUESTS_PER_WINDOW) {
    const retryAfterSeconds = Math.ceil((entry.windowStart + WINDOW_MS - now) / 1000);
    return { allowed: false, retryAfterSeconds };
  }

  entry.count += 1;
  return { allowed: true };
}

export function reportRateLimit(req: Request, res: Response, next: NextFunction): void {
  const key = req.ip ?? 'unknown';
  const result = checkRateLimit(key);

  if (!result.allowed) {
    res.status(429).set('Retry-After', String(result.retryAfterSeconds)).json({
      error: `Too many reports from this device — try again in ${result.retryAfterSeconds}s.`,
    });
    return;
  }

  next();
}
