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
  /** A calmer heading for a chase camera: the route's direction over a wider stretch, so the view
   * sweeps through turns instead of following every wobble. */
  cameraHeading: number | null;
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

/** The car points at the route this far ahead: far enough to ignore GPS wobble, close enough for turns. */
export const HEADING_AHEAD_M = 15;

/** The spot `m` metres into the drive, along the route. */
const atMeters = (track: ReplayTrack, m: number): {latitude: number; longitude: number} => {
  const {points, meters} = track;
  const target = Math.min(Math.max(m, 0), meters[meters.length - 1]);
  let lo = 0;
  let hi = points.length - 1;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (meters[mid] <= target) {
      lo = mid;
    } else {
      hi = mid - 1;
    }
  }
  const a = points[lo];
  const b = points[Math.min(lo + 1, points.length - 1)];
  const span = meters[Math.min(lo + 1, points.length - 1)] - meters[lo];
  const f = span > 0 ? (target - meters[lo]) / span : 0;
  return {latitude: a.latitude + (b.latitude - a.latitude) * f, longitude: a.longitude + (b.longitude - a.longitude) * f};
};

/**
 * The direction of travel at a spot on the route: from it towards the route a little ahead (or, at
 * the very end, from a little behind). Smooth, because it follows the car's exact position rather
 * than jumping from one GPS point to the next. Null when the drive never moved.
 */
const headingAt = (track: ReplayTrack, m: number): number | null => {
  const total = track.meters[track.meters.length - 1] ?? 0;
  if (total < 3) {
    return null;
  }
  const here = atMeters(track, m);
  const ahead = m + HEADING_AHEAD_M <= total ? atMeters(track, m + HEADING_AHEAD_M) : here;
  const from = ahead === here ? atMeters(track, Math.max(0, total - HEADING_AHEAD_M)) : here;
  const to = ahead === here ? atMeters(track, total) : ahead;
  return bearingBetween(from, to);
};

/** The chase camera looks along the route over this stretch behind and ahead of the car. */
export const CAMERA_SPAN_M = 25;

const cameraHeadingAt = (track: ReplayTrack, m: number): number | null => {
  const total = track.meters[track.meters.length - 1] ?? 0;
  if (total < 3) {
    return null;
  }
  return bearingBetween(atMeters(track, Math.max(0, m - CAMERA_SPAN_M)), atMeters(track, Math.min(total, m + CAMERA_SPAN_M)));
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
    heading: headingAt(track, lerp(meters[i], meters[Math.min(i + 1, points.length - 1)])),
    cameraHeading: cameraHeadingAt(track, lerp(meters[i], meters[Math.min(i + 1, points.length - 1)])),
    index: i,
  };
};
