/**
 * Cross-checking a GPS braking or acceleration event against the OBD-II adapter's wheel speed
 * (spec 2026-10-25, telemetry sources, section 1). GPS speed jumps in urban canyons and under
 * bridges; the wheels don't.
 */

/** Adapter speed readings, oldest first: time (ms) and km/h. */
export type AdapterTrace = {t: number; kmh: number}[];

/** Adapter readings this far either side of the two fixes count as evidence. */
export const CHECK_WINDOW_MS = 2000;
/** Share of the GPS speed change the adapter has to show for the event to stand. */
export const CONFIRM_SHARE = 0.6;

type Fix = {timestamp: number; speedMps: number | null};

/**
 * Whether the adapter saw the speed change between fixes `a` and `b`: true (it did), false (it did
 * not: a GPS glitch), or null (too few adapter readings to say).
 */
export const adapterConfirms = (a: Fix, b: Fix, trace: AdapterTrace): boolean | null => {
  if (a.speedMps == null || b.speedMps == null) {
    return null;
  }
  const from = a.timestamp - CHECK_WINDOW_MS;
  const to = b.timestamp + CHECK_WINDOW_MS;
  const speeds = trace.filter((r) => r.t >= from && r.t <= to).map((r) => r.kmh / 3.6);
  if (speeds.length < 2) {
    return null;
  }
  const gpsChange = b.speedMps - a.speedMps;
  // Largest change in the event's direction between any earlier and later adapter reading.
  let best = 0;
  let low = speeds[0];
  let high = speeds[0];
  for (const v of speeds.slice(1)) {
    best = gpsChange >= 0 ? Math.max(best, v - low) : Math.max(best, high - v);
    low = Math.min(low, v);
    high = Math.max(high, v);
  }
  return best >= CONFIRM_SHARE * Math.abs(gpsChange);
};
