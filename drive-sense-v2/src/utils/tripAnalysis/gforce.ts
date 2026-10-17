import {FAST_GAP_S, MAX_ACCEL_MPS2, type CleanPoint} from './prepare';
import {thin} from './thin';

export const GRAVITY = 9.80665;
/** Beyond this a road car cannot accelerate or brake: the same limit the speed-spike filter uses. */
export const MAX_G = MAX_ACCEL_MPS2 / GRAVITY;

export interface GSample {
  t: number;
  /** Positive is speeding up, negative is braking. */
  g: number;
  latitude: number;
  longitude: number;
}

/**
 * Forward G from speed changes between steady GPS fixes. Works for every recorded trip, not only
 * ones with phone sensor data; long gaps are skipped because a change across them is not one push.
 */
export const gForceSeries = (points: CleanPoint[], maxSamples = 200): {samples: GSample[]; peakAccel: GSample | null; peakBrake: GSample | null} => {
  const all: GSample[] = [];
  for (let i = 1; i < points.length; i += 1) {
    const from = points[i - 1];
    const to = points[i];
    const dt = (to.t - from.t) / 1000;
    if (dt <= 0 || dt > FAST_GAP_S) {
      continue;
    }
    const g = (to.mps - from.mps) / dt / GRAVITY;
    if (Math.abs(g) <= MAX_G) {
      all.push({t: to.t, g, latitude: to.latitude, longitude: to.longitude});
    }
  }
  const peakAccel = all.reduce<GSample | null>((best, s) => (s.g > 0 && (!best || s.g > best.g) ? s : best), null);
  const peakBrake = all.reduce<GSample | null>((best, s) => (s.g < 0 && (!best || s.g < best.g) ? s : best), null);
  const samples = thin(all, maxSamples);
  for (const peak of [peakAccel, peakBrake]) {
    if (peak && !samples.includes(peak)) {
      samples.push(peak);
    }
  }
  samples.sort((a, b) => a.t - b.t);
  return {samples, peakAccel, peakBrake};
};
