import type {TripPoint} from '../../services/tripService';
import {haversineMeters} from '../geo';

/** Below this the car counts as stopped (same as the Drive page). */
export const STOPPED_KMH = 5;
/** Gaps up to this long are steady GPS: the first point's own speed holds across them. */
export const FAST_GAP_S = 5;
/** Longer gaps are a paused drive, not driving or idling. */
export const MAX_GAP_S = 600;
/** A speed change needing more than this is a GPS spike (≈ 0.9 g; same rule as recording). */
export const MAX_ACCEL_MPS2 = 9;

export interface CleanPoint {
  t: number;
  latitude: number;
  longitude: number;
  mps: number;
  altitude: number | null;
}

export interface Segment {
  from: CleanPoint;
  to: CleanPoint;
  seconds: number;
  meters: number;
  kmh: number;
}

/** Timed points in order, with a trustworthy speed each. */
export const cleanPoints = (points: TripPoint[]): CleanPoint[] => {
  const timed = points
    .map((p) => ({p, t: Date.parse(p.recorded_at)}))
    .filter(({t}) => Number.isFinite(t))
    .sort((a, b) => a.t - b.t);

  const out: CleanPoint[] = [];
  // The last speed we believed and when: a spike is judged against it over the whole time since,
  // so one rejected reading cannot lock out a real speed-up that follows.
  let trusted: {mps: number; t: number} | null = null;
  for (const {p, t} of timed) {
    const prev = out[out.length - 1];
    const dt = prev ? (t - prev.t) / 1000 : 0;
    let mps = p.speed_mps != null && p.speed_mps >= 0 ? p.speed_mps : prev && dt > 0 ? haversineMeters(prev, p) / dt : 0;
    const since = trusted ? (t - trusted.t) / 1000 : 0;
    if (trusted && since > 0 && Math.abs(mps - trusted.mps) / since > MAX_ACCEL_MPS2) {
      mps = trusted.mps;
    } else {
      trusted = {mps, t};
    }
    out.push({
      t,
      latitude: p.latitude,
      longitude: p.longitude,
      mps,
      altitude: p.altitude_m != null && p.altitude_m !== 0 ? p.altitude_m : null,
    });
  }
  return out;
};

/**
 * Consecutive pairs. Background GPS only reports after 2 m of movement, so a standing car leaves
 * a long gap: across one, speed is distance ÷ time (a red light reads as stopped, a dropout on a
 * highway as moving).
 */
export const segments = (points: CleanPoint[]): Segment[] => {
  const out: Segment[] = [];
  for (let i = 1; i < points.length; i += 1) {
    const from = points[i - 1];
    const to = points[i];
    const seconds = (to.t - from.t) / 1000;
    if (seconds <= 0 || seconds > MAX_GAP_S) {
      continue;
    }
    const meters = haversineMeters(from, to);
    const mps = seconds <= FAST_GAP_S ? from.mps : meters / seconds;
    out.push({from, to, seconds, meters, kmh: mps * 3.6});
  }
  return out;
};
