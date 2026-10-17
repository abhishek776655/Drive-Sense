import {haversineMeters} from '../geo';
import {bearingBetween} from '../heading';
import {GRAVITY, MAX_G} from './gforce';
import {FAST_GAP_S, MAX_GAP_S, type CleanPoint} from './prepare';

/** The drive laid on a replay timeline. */
export interface ReplayTrack {
  points: CleanPoint[];
  /** Milliseconds from the start of the replay, per point. */
  t: number[];
  /** Distance driven so far, per point. */
  meters: number[];
  durationMs: number;
}

export interface ReplayFrame {
  latitude: number;
  longitude: number;
  kmh: number;
  meters: number;
  g: number;
  heading: number | null;
  /** The point at or before this moment: the route is drawn up to here. */
  index: number;
}

/** Pauses (gaps over MAX_GAP_S) take no time in the replay. */
export const buildReplay = (points: CleanPoint[]): ReplayTrack => {
  const t: number[] = [];
  const meters: number[] = [];
  points.forEach((p, i) => {
    if (i === 0) {
      t.push(0);
      meters.push(0);
      return;
    }
    const prev = points[i - 1];
    const dt = p.t - prev.t;
    t.push(t[i - 1] + (dt > MAX_GAP_S * 1000 ? 0 : Math.max(0, dt)));
    meters.push(meters[i - 1] + haversineMeters(prev, p));
  });
  return {points, t, meters, durationMs: t[t.length - 1] ?? 0};
};

/** Heading at point i: towards the next point that is far enough away to give a direction. */
const headingFrom = (points: CleanPoint[], i: number): number | null => {
  for (let j = i + 1; j < Math.min(points.length, i + 20); j += 1) {
    if (haversineMeters(points[i], points[j]) > 3) {
      return bearingBetween(points[i], points[j]);
    }
  }
  for (let j = i - 1; j >= Math.max(0, i - 20); j -= 1) {
    if (haversineMeters(points[j], points[i]) > 3) {
      return bearingBetween(points[j], points[i]);
    }
  }
  return null;
};

/** Where the car was, how fast, how far and how hard it pushed, `ms` into the replay. */
export const replayAt = (track: ReplayTrack, ms: number): ReplayFrame | null => {
  const {points, t, meters, durationMs} = track;
  if (points.length === 0) {
    return null;
  }
  const at = Math.min(Math.max(ms, 0), durationMs);
  // Last point at or before `at`.
  let lo = 0;
  let hi = points.length - 1;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (t[mid] <= at) {
      lo = mid;
    } else {
      hi = mid - 1;
    }
  }
  const i = lo;
  const a = points[i];
  const b = points[Math.min(i + 1, points.length - 1)];
  const span = (t[Math.min(i + 1, points.length - 1)] ?? t[i]) - t[i];
  const f = span > 0 ? (at - t[i]) / span : 0;
  const lerp = (x: number, y: number) => x + (y - x) * f;
  const dtS = (b.t - a.t) / 1000;
  const g = dtS > 0 && dtS <= FAST_GAP_S ? (b.mps - a.mps) / dtS / GRAVITY : 0;
  return {
    latitude: lerp(a.latitude, b.latitude),
    longitude: lerp(a.longitude, b.longitude),
    kmh: lerp(a.mps, b.mps) * 3.6,
    meters: lerp(meters[i], meters[Math.min(i + 1, points.length - 1)]),
    g: Math.abs(g) <= MAX_G ? g : 0,
    heading: headingFrom(points, i),
    index: i,
  };
};
