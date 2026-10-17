import type {TripPoint} from '../../services/tripService';
import {FAST_GAP_S, STOPPED_KMH, type CleanPoint, type Segment} from './prepare';
import type {Stop} from './stops';

/** Comfort thresholds for smoothness (gentler than the harsh-event ones, which almost never fire). */
export const SMOOTH_MPS2 = 1.5;
export const HARSH_MPS2 = 3;
/** Fewer steady pairs than this say nothing about how smoothly someone drove. */
const MIN_SMOOTH_SAMPLES = 10;

/**
 * 0–100 from how gently speed changed between steady GPS fixes while moving: a smooth change counts
 * fully, a firm one half, a harsh one not at all. Null for a drive too short to judge.
 */
export const smoothnessScore = (points: CleanPoint[]): number | null => {
  let smooth = 0;
  let firm = 0;
  let total = 0;
  for (let i = 1; i < points.length; i += 1) {
    const dt = (points[i].t - points[i - 1].t) / 1000;
    if (dt <= 0 || dt > FAST_GAP_S || Math.max(points[i].mps, points[i - 1].mps) * 3.6 < STOPPED_KMH) {
      continue;
    }
    const accel = Math.abs(points[i].mps - points[i - 1].mps) / dt;
    total += 1;
    if (accel < SMOOTH_MPS2) {
      smooth += 1;
    } else if (accel < HARSH_MPS2) {
      firm += 1;
    }
  }
  return total < MIN_SMOOTH_SAMPLES ? null : Math.round((100 * (smooth + firm / 2)) / total);
};

/** Moving time above a speed (km/h) and its share of moving time. */
export const timeOverLimit = (segs: Segment[], limitKmh: number): {seconds: number; share: number | null} => {
  let over = 0;
  let moving = 0;
  for (const s of segs) {
    if (s.kmh < STOPPED_KMH) {
      continue;
    }
    moving += s.seconds;
    if (s.kmh > limitKmh) {
      over += s.seconds;
    }
  }
  return {seconds: over, share: moving > 0 ? over / moving : null};
};

export const stopSummary = (stops: Stop[]): {longestS: number; averageS: number} | null =>
  stops.length === 0
    ? null
    : {longestS: Math.max(...stops.map((s) => s.durationS)), averageS: stops.reduce((sum, s) => sum + s.durationS, 0) / stops.length};

export type GpsGrade = 'good' | 'fair' | 'poor';

/**
 * How far the drive's GPS fixes can be trusted: the median reported accuracy, and the share of
 * fixes worse than 25 m. Good ≤ 10 m, fair ≤ 25 m, else poor. Null when the phone reported none.
 */
export const gpsQuality = (raw: TripPoint[]): {medianM: number; poorShare: number; grade: GpsGrade} | null => {
  const values = raw.map((p) => p.accuracy_m).filter((a): a is number => a != null && Number.isFinite(a) && a > 0).sort((a, b) => a - b);
  if (values.length === 0) {
    return null;
  }
  const mid = Math.floor(values.length / 2);
  const medianM = values.length % 2 ? values[mid] : (values[mid - 1] + values[mid]) / 2;
  const poorShare = values.filter((a) => a > 25).length / values.length;
  const grade: GpsGrade = medianM <= 10 && poorShare < 0.2 ? 'good' : medianM <= 25 ? 'fair' : 'poor';
  return {medianM, poorShare, grade};
};

/** The phone's own G readings along the drive (total, not signed), when sensors ran. */
export const sensorGSeries = (raw: TripPoint[]): {t: number; g: number}[] =>
  raw
    .filter((p) => p.peak_g != null && Number.isFinite(p.peak_g))
    .map((p) => ({t: Date.parse(p.recorded_at), g: p.peak_g as number}))
    .filter((s) => Number.isFinite(s.t))
    .sort((a, b) => a.t - b.t);
