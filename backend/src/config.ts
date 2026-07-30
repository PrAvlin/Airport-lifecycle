import 'dotenv/config';

function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export const config = {
  port: envInt('PORT', 4000),

  aerodatabox: {
    apiKey: process.env.AERODATABOX_API_KEY ?? '',
    host: process.env.AERODATABOX_HOST ?? 'aerodatabox.p.rapidapi.com',
    get enabled() {
      return this.apiKey.length > 0;
    },
    // Free RapidAPI quotas are small (order of ~100 calls/month), so poll slowly
    // and cache aggressively rather than hitting the API every few seconds.
    pollIntervalMs: envInt('AERODATABOX_POLL_INTERVAL_MS', 10 * 60_000),
    windowHoursBack: envInt('AERODATABOX_WINDOW_HOURS_BACK', 2),
    windowHoursForward: envInt('AERODATABOX_WINDOW_HOURS_FORWARD', 10),
  },

  tomtom: {
    apiKey: process.env.TOMTOM_API_KEY ?? '',
    get enabled() {
      return this.apiKey.length > 0;
    },
  },
};
