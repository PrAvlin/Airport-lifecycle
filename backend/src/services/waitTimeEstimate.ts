/**
 * No free API publishes live BLR security/immigration queue lengths, or
 * arrival-side immigration/baggage wait for any airport, so these give
 * typical-for-time-of-day estimates rather than fabricated live telemetry.
 * Callers should label them as estimates, not live readings.
 */
export function estimateSecurityWaitMinutes(at: Date = new Date()): number {
  const hour = at.getHours();
  const isPeak = (hour >= 5 && hour < 9) || (hour >= 17 && hour < 21);
  return isPeak ? 20 : 10;
}

export function estimateImmigrationWaitMinutes(at: Date = new Date()): number {
  const hour = at.getHours();
  const isPeak = (hour >= 20 && hour < 24) || (hour >= 0 && hour < 3);
  return isPeak ? 25 : 12;
}

function hourInTimezone(at: Date, timezone: string): number {
  try {
    const formatted = new Intl.DateTimeFormat('en-US', { hour: 'numeric', hour12: false, timeZone: timezone }).format(at);
    return parseInt(formatted, 10) % 24;
  } catch {
    return at.getUTCHours();
  }
}

export function estimateArrivalImmigrationWaitMinutes(at: Date, timezone: string): number {
  const hour = hourInTimezone(at, timezone);
  const isPeak = (hour >= 18 && hour < 23) || (hour >= 6 && hour < 9);
  return isPeak ? 35 : 18;
}

export function estimateBaggageWaitMinutes(isInternational: boolean): number {
  return isInternational ? 30 : 20;
}
