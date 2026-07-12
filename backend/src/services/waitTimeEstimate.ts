/**
 * No free API publishes live domestic security queue lengths or arrival-side
 * baggage wait for any airport, so these give typical-for-time-of-day
 * estimates rather than fabricated live telemetry. Callers should label them
 * as estimates, not live readings.
 */

// Every supported airport is in India, so "peak hours" always means IST -
// using the server process's own local hour would be wrong whenever the
// server itself doesn't run in IST (e.g. a UTC-based Codespace/host), off by
// a fixed 5.5 hours.
function istHour(at: Date): number {
  const formatted = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    hour12: false,
    timeZone: 'Asia/Kolkata',
  }).format(at);
  return formatted === '24' ? 0 : Number(formatted);
}

export function estimateSecurityWaitMinutes(at: Date = new Date()): number {
  const hour = istHour(at);
  const isPeak = (hour >= 5 && hour < 9) || (hour >= 17 && hour < 21);
  return isPeak ? 20 : 10;
}

export function estimateBaggageWaitMinutes(): number {
  return 20;
}
