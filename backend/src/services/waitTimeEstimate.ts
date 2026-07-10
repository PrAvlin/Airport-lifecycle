/**
 * No free API publishes live domestic security queue lengths or arrival-side
 * baggage wait for any airport, so these give typical-for-time-of-day
 * estimates rather than fabricated live telemetry. Callers should label them
 * as estimates, not live readings.
 */
export function estimateSecurityWaitMinutes(at: Date = new Date()): number {
  const hour = at.getHours();
  const isPeak = (hour >= 5 && hour < 9) || (hour >= 17 && hour < 21);
  return isPeak ? 20 : 10;
}

export function estimateBaggageWaitMinutes(): number {
  return 20;
}
