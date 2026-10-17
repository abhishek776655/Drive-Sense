import type {TripPoint} from '../services/tripService';

/**
 * What the stats need from one drive's GPS points, worked out once when its route is stored (spec
 * 2026-10-17, local-first part 2c). Mirrors `stats_overview_service` and `home_stats_service`.
 */
export interface PointStats {
  /** Highest and lowest altitude, ignoring the 0.0 phones report without an altitude fix. */
  altMax: number | null;
  altMin: number | null;
  /** Climb along the drive; null without altitude. */
  climb: number | null;
  /** Moving seconds and metres per 20 km/h band (`SPEED_BAND_LABELS`). */
  bands: [number, number][];
  /**
   * Moving seconds by `ceil(km/h) - 1`, so "faster than L km/h" is exactly every key >= L for a
   * whole-number limit (the Settings speed alert).
   */
  over: Record<string, number>;
}

export const BAND_WIDTH_KMH = 20;
export const SPEED_BAND_LABELS = ['0–20', '20–40', '40–60', '60–80', '80–100', '100+'];
export const STOPPED_KMH = 5;
/** Longer gaps between points are the phone pausing, not driving at the last speed. */
export const MAX_GAP_SECONDS = 600;
/** Altitude must move this far from the last counted height before it counts: GPS altitude jitters. */
export const ELEVATION_STEP_M = 3;

export const bandIndex = (kmh: number) => Math.min(Math.max(Math.floor(kmh / BAND_WIDTH_KMH), 0), SPEED_BAND_LABELS.length - 1);

/** `elevation_gain`: a rise counts only once it beats the jitter step. */
export const elevationGain = (altitudes: number[]): number => {
  let gain = 0;
  let ref: number | null = null;
  for (const altitude of altitudes) {
    if (ref == null) {
      ref = altitude;
    } else if (Math.abs(altitude - ref) >= ELEVATION_STEP_M) {
      if (altitude > ref) {
        gain += altitude - ref;
      }
      ref = altitude;
    }
  }
  return gain;
};

export function pointStats(points: TripPoint[]): PointStats {
  const ordered = [...points].sort((a, b) => Date.parse(a.recorded_at) - Date.parse(b.recorded_at));
  const altitudes = ordered.map((p) => p.altitude_m).filter((a): a is number => a != null && a !== 0);
  const bands: [number, number][] = SPEED_BAND_LABELS.map(() => [0, 0]);
  const over: Record<string, number> = {};
  // Each pair of points is an interval driven at the earlier point's speed.
  for (let i = 1; i < ordered.length; i++) {
    const dt = (Date.parse(ordered[i].recorded_at) - Date.parse(ordered[i - 1].recorded_at)) / 1000;
    const v = ordered[i - 1].speed_mps;
    if (v == null || !(dt > 0) || dt > MAX_GAP_SECONDS || v * 3.6 < STOPPED_KMH) {
      continue;
    }
    const band = bands[bandIndex(v * 3.6)];
    band[0] += dt;
    band[1] += dt * v;
    const key = String(Math.ceil(v * 3.6) - 1);
    over[key] = (over[key] ?? 0) + dt;
  }
  return {
    altMax: altitudes.length ? Math.max(...altitudes) : null,
    altMin: altitudes.length ? Math.min(...altitudes) : null,
    climb: altitudes.length ? elevationGain(altitudes) : null,
    bands,
    over,
  };
}

/** Moving seconds faster than `limitKmh`. */
export const secondsOver = (stats: PointStats, limitKmh: number) =>
  Object.entries(stats.over).reduce((sum, [key, seconds]) => (Number(key) >= limitKmh ? sum + seconds : sum), 0);
