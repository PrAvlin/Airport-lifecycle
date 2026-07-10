const IST_TIME_ZONE = 'Asia/Kolkata';

/** All three origin airports (BLR/MAA/CJB) are IST — show departure-side times explicitly in IST, regardless of the viewing device's own timezone. */
export function formatIstTime(iso: string | Date): string {
  const time = new Date(iso).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: IST_TIME_ZONE,
  });
  return `${time} IST`;
}

/** Arrival-side times are shown in the destination airport's own local timezone, labeled "local" by the caller. */
export function formatTimeInZone(iso: string, timeZone: string): string {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZone });
  } catch {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
}

/** Wall-clock flight duration between two ISO timestamps, e.g. "2h 35m". */
export function formatDuration(startIso: string, endIso: string): string {
  const totalMinutes = Math.round((new Date(endIso).getTime() - new Date(startIso).getTime()) / 60_000);
  if (totalMinutes <= 0) return '—';
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}
