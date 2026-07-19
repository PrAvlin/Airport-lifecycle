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

export function reportRateLimit(req: Request, res: Response, next: NextFunction): void {
  const key = req.ip ?? 'unknown';
  const now = Date.now();
  const entry = hits.get(key);

  if (!entry || now - entry.windowStart >= WINDOW_MS) {
    hits.set(key, { count: 1, windowStart: now });
    next();
    return;
  }

  if (entry.count >= MAX_REQUESTS_PER_WINDOW) {
    const retryAfterSeconds = Math.ceil((entry.windowStart + WINDOW_MS - now) / 1000);
    res.status(429).set('Retry-After', String(retryAfterSeconds)).json({
      error: `Too many reports from this device — try again in ${retryAfterSeconds}s.`,
    });
    return;
  }

  entry.count += 1;
  next();
}
