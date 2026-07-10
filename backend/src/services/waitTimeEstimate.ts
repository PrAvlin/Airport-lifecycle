/**
 * No free API publishes live BLR security/immigration queue lengths, so this
 * gives a typical-for-time-of-day estimate rather than fabricated live
 * telemetry. Callers should label this as an estimate, not a live reading.
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
