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
